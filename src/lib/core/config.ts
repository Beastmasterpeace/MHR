import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { API_PORT, CERTS_DIR, CONFIG_PATH, RUNTIME_DIR, XRAY_BIN } from "@/lib/core/paths";

const exec = promisify(execFile);

// ساخت کانفیگ کامل Xray از روی دیتابیس پنل — کد کاملاً اختصاصی MHR

export type CoreUserInfo = {
  id: string;
  name: string;
  uuid: string;
  email: string;
};

export type BuiltInbound = {
  id: string;
  name: string;
  protocol: string;
  port: number;
  tag: string;
  tlsEnabled: boolean;
  fragmentEnabled: boolean;
  userCount: number;
};

export type BuiltConfig = {
  config: Record<string, unknown>;
  inbounds: BuiltInbound[];
  users: CoreUserInfo[];
  issues: string[];
};

// کاربر فقط وقتی در هسته قرار می‌گیرد که فعال، غیرمنقضی و زیر سهمیه باشد
export function isUserEligible(u: {
  active: boolean;
  expiresAt: Date | null;
  unlimited: boolean;
  quotaBytes: number;
  usedBytes: number;
}): boolean {
  if (!u.active) return false;
  if (u.expiresAt && u.expiresAt.getTime() < Date.now()) return false;
  if (!u.unlimited && u.quotaBytes > 0 && u.usedBytes >= u.quotaBytes) return false;
  return true;
}

export function userEmail(userId: string): string {
  return `mhr-${userId}`;
}

// اطمینان از وجود شناسه UUID برای هر کاربر (پشتیبانی از رکوردهای قدیمی)
async function ensureUuid(id: string): Promise<string | null> {
  const user = await db.panelUser.findUnique({ where: { id }, select: { uuid: true } });
  if (user?.uuid) return user.uuid;
  const uuid = randomUUID();
  try {
    await db.panelUser.update({ where: { id }, data: { uuid } });
    return uuid;
  } catch {
    return null;
  }
}

// تولید گواهی TLS self-signed با openssl تا اینباند TLS بدون گواهی بیرونی هم بالا بیاید
async function ensureSelfSignedCert(inboundId: string, sni: string | null): Promise<boolean> {
  const certFile = path.join(CERTS_DIR, `${inboundId}.pem`);
  const keyFile = path.join(CERTS_DIR, `${inboundId}.key`);
  if (existsSync(certFile) && existsSync(keyFile)) return true;
  try {
    await mkdir(CERTS_DIR, { recursive: true });
    const cn = sni || "mhr.local";
    await exec("openssl", [
      "req",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-x509",
      "-days",
      "3650",
      "-subj",
      `/CN=${cn}`,
      "-keyout",
      keyFile,
      "-out",
      certFile,
    ]);
    return true;
  } catch {
    return false;
  }
}

// تولید کلیدهای سرور ECH با ابزار خود Xray (xray tls ech)
async function ensureEchServerKeys(inboundId: string, sni: string | null): Promise<string | null> {
  const echFile = path.join(CERTS_DIR, `${inboundId}.ech`);
  if (existsSync(echFile)) {
    try {
      return (await readFile(echFile, "utf8")).trim() || null;
    } catch {
      return null;
    }
  }
  try {
    await mkdir(CERTS_DIR, { recursive: true });
    const { stdout } = await exec(XRAY_BIN, ["tls", "ech", "--serverName", sni || "mhr.local"], {
      timeout: 15000,
    });
    const priv = stdout.match(/ECH server keys:\s*\n\s*([A-Za-z0-9+/=]+)/);
    const pub = stdout.match(/ECH config list:\s*\n\s*([A-Za-z0-9+/=]+)/);
    if (!priv) return null;
    await writeFile(echFile, priv[1]);
    // لیست عمومی ECH برای انتشار در رکورد DNS/HTTPS نگه داشته می‌شود
    if (pub) await writeFile(`${echFile}.pub`, pub[1]);
    return priv[1];
  } catch {
    return null;
  }
}

export async function buildConfig(): Promise<BuiltConfig> {
  const issues: string[] = [];
  const builtFragments: Record<string, unknown>[] = [];

  const [dbUsers, dbInbounds] = await Promise.all([
    db.panelUser.findMany({ orderBy: { createdAt: "asc" } }),
    db.inbound.findMany({ where: { enabled: true }, orderBy: { port: "asc" } }),
  ]);

  // شناسه هر کاربر (در صورت نبود، ساخته و ذخیره می‌شود)
  const uuidById = new Map<string, string>();
  for (const u of dbUsers) {
    const uuid = await ensureUuid(u.id);
    if (uuid) uuidById.set(u.id, uuid);
    else issues.push(`شناسه UUID برای کاربر «${u.name}» ساخته نشد`);
  }

  const coreUsers: CoreUserInfo[] = dbUsers
    .filter((u) => uuidById.has(u.id))
    .map((u) => ({ id: u.id, name: u.name, uuid: uuidById.get(u.id)!, email: userEmail(u.id) }));

  const eligible = dbUsers.filter((u) => isUserEligible(u));
  const eligibleIds = new Set(eligible.map((u) => u.id));

  const xInbounds: Record<string, unknown>[] = [];
  const routingRules: Record<string, unknown>[] = [
    { type: "field", inboundTag: ["mhr-api"], outboundTag: "api" },
    { type: "field", protocol: ["bittorrent"], outboundTag: "block" },
  ];
  const builtInbounds: BuiltInbound[] = [];

  for (const inb of dbInbounds) {
    const tag = `in-${inb.id}`;
    const clients = coreUsers
      .filter((u) => eligibleIds.has(u.id))
      .map((u) => {
        if (inb.protocol === "trojan") {
          return { password: u.uuid, email: u.email, level: 0 };
        }
        const base: Record<string, unknown> = { id: u.uuid, email: u.email, level: 0 };
        if (inb.protocol === "vless" && inb.tlsEnabled) base.flow = "xtls-rprx-vision";
        return base;
      });

    const stream: Record<string, unknown> = { network: "tcp" };
    if (inb.tlsEnabled) {
      const ok = await ensureSelfSignedCert(inb.id, inb.sni);
      if (ok) {
        let echKeys: string | null = null;
        if (inb.echEnabled) {
          echKeys = await ensureEchServerKeys(inb.id, inb.sni);
          if (!echKeys) issues.push(`کلید ECH برای اینباند «${inb.name}» ساخته نشد`);
        }
        stream.security = "tls";
        stream.tlsSettings = {
          ...(inb.sni ? { serverName: inb.sni } : {}),
          ...(echKeys ? { echServerKeys: echKeys } : {}),
          certificates: [
            {
              certificateFile: path.join(CERTS_DIR, `${inb.id}.pem`),
              keyFile: path.join(CERTS_DIR, `${inb.id}.key`),
            },
          ],
        };
      } else {
        issues.push(`گواهی TLS برای اینباند «${inb.name}» تولید نشد (openssl در دسترس نیست)`);
      }
    }

    xInbounds.push({
      tag,
      port: inb.port,
      protocol: inb.protocol,
      settings:
        inb.protocol === "vless"
          ? { decryption: "none", clients }
          : { clients },
      streamSettings: stream,
      sniffing: { enabled: true, destOverride: ["http", "tls"] },
    });
    builtInbounds.push({
      id: inb.id,
      name: inb.name,
      protocol: inb.protocol,
      port: inb.port,
      tag,
      tlsEnabled: inb.tlsEnabled,
      fragmentEnabled: inb.fragmentEnabled,
      userCount: clients.length,
    });

    // ترافیک اینباند‌های دارای Fragment از خروجی freedom با تنظیم fragment عبور می‌کند
    if (inb.fragmentEnabled) {
      const fragTag = `frag-${inb.id}`;
      builtFragments.push({
        tag: fragTag,
        protocol: "freedom",
        settings: {
          domainStrategy: "AsIs",
          fragment: {
            packets: "tlshello",
            length: inb.fragmentSize || "100-200",
            interval: inb.fragmentInterval || "10-20",
          },
        },
      });
      routingRules.push({ type: "field", inboundTag: [tag], outboundTag: fragTag });
    }
  }

  // اینباند API داخلی (فقط لوکال‌هاست) برای خواندن آمار ترافیک
  xInbounds.push({
    tag: "mhr-api",
    listen: "127.0.0.1",
    port: API_PORT,
    protocol: "dokodemo-door",
    settings: { address: "127.0.0.1" },
  });

  const config: Record<string, unknown> = {
    log: { loglevel: "warning" },
    stats: {},
    api: { tag: "api", services: ["StatsService"] },
    policy: {
      levels: { "0": { statsUserUplink: true, statsUserDownlink: true } },
      system: {
        statsInboundUplink: true,
        statsInboundDownlink: true,
      },
    },
    inbounds: xInbounds,
    outbounds: [
      { tag: "direct", protocol: "freedom", settings: { domainStrategy: "AsIs" } },
      { tag: "block", protocol: "blackhole", settings: { response: { type: "none" } } },
      ...builtFragments,
    ],
    routing: {
      rules: [...routingRules, { type: "field", network: "tcp,udp", outboundTag: "direct" }],
    },
  };

  return { config, inbounds: builtInbounds, users: coreUsers, issues };
}

export async function writeConfig(config: Record<string, unknown>): Promise<void> {
  await mkdir(RUNTIME_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}
