import type { Inbound } from "@prisma/client";

// ساخت لینک‌های اشتراک استاندارد (vless:// / vmess:// / trojan://) برای هر کاربر
// کد کاملاً اختصاصی MHR است.

export type ShareLink = {
  remark: string;
  uri: string;
  protocol: string;
  port: number;
  inboundName: string;
};

function sanitizeHost(raw: string): string {
  // حذف scheme و اسلش اضافه؛ فقط host[:port]
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

export function buildLinks(
  user: { name: string; uuid: string | null },
  inbounds: Inbound[],
  host: string
): ShareLink[] {
  if (!user.uuid) return [];
  const address = sanitizeHost(host);
  if (!address) return [];
  const links: ShareLink[] = [];

  for (const inb of inbounds) {
    if (!inb.enabled) continue;
    const remark = encodeURIComponent(`${user.name} | ${inb.name}`);
    const security = inb.tlsEnabled ? "tls" : "none";
    const sni = inb.sni ? `&sni=${encodeURIComponent(inb.sni)}` : "";

    if (inb.protocol === "vless") {
      const flow = inb.tlsEnabled ? "&flow=xtls-rprx-vision" : "";
      const ech = inb.echEnabled && inb.tlsEnabled ? "&ech=auto" : "";
      const uri =
        `vless://${user.uuid}@${address}:${inb.port}` +
        `?encryption=none&type=tcp&security=${security}${sni}${flow}${ech}&fp=chrome#${remark}`;
      links.push({ remark: `${user.name} | ${inb.name}`, uri, protocol: "vless", port: inb.port, inboundName: inb.name });
    } else if (inb.protocol === "trojan") {
      const uri =
        `trojan://${user.uuid}@${address}:${inb.port}` +
        `?type=tcp&security=${security}${sni}#${remark}`;
      links.push({ remark: `${user.name} | ${inb.name}`, uri, protocol: "trojan", port: inb.port, inboundName: inb.name });
    } else if (inb.protocol === "vmess") {
      const payload = {
        v: "2",
        ps: `${user.name} | ${inb.name}`,
        add: address,
        port: String(inb.port),
        id: user.uuid,
        aid: "0",
        scy: "auto",
        net: "tcp",
        type: "none",
        host: "",
        path: "",
        tls: inb.tlsEnabled ? "tls" : "",
        sni: inb.sni ?? "",
        fp: "chrome",
      };
      const uri = `vmess://${Buffer.from(JSON.stringify(payload)).toString("base64")}`;
      links.push({ remark: `${user.name} | ${inb.name}`, uri, protocol: "vmess", port: inb.port, inboundName: inb.name });
    }
  }

  return links;
}
