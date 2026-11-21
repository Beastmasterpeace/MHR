import { spawn, execFile, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { db } from "@/lib/db";
import { getSetting, logActivity, setSetting } from "@/lib/activity";
import { buildConfig, isUserEligible, writeConfig, type BuiltConfig } from "@/lib/core/config";
import { API_ADDR, API_PORT, CORE_DIR, XRAY_BIN } from "@/lib/core/paths";

const exec = promisify(execFile);

// راهبر فرایند هسته ترافیک: اجرا، توقف، همگام‌سازی کانفیگ و جمع‌آوری آمار زنده
// کد کاملاً اختصاصی MHR است.

export type CoreStatus = "stopped" | "starting" | "running" | "error";

type PollSnapshot = {
  totals: { up: number; down: number };
  rates: { up: number; down: number };
  users: Map<string, { up: number; down: number }>; // کلید: userId
  inboundTags: Map<string, { up: number; down: number }>; // کلید: tag اینباند
};

type CoreState = {
  proc: ChildProcess | null;
  procPid: number | null;
  manualStop: boolean;
  status: CoreStatus;
  startedAt: number | null;
  lastError: string | null;
  exitCode: number | null;
  logs: string[];
  version: string | null;
  lastBuild: BuiltConfig | null;
  runningConfig: string | null;
  syncTimer: ReturnType<typeof setTimeout> | null;
  statsTimer: ReturnType<typeof setInterval> | null;
  lastPollAt: number | null;
  prevTotals: { up: number; down: number } | null;
  lastEmailToUser: Map<string, string>;
  lastSnapshot: PollSnapshot | null;
  overQuotaNotified: Set<string>;
  restartAttempts: number;
  versionLoading: Promise<string | null> | null;
};

const g = globalThis as typeof globalThis & { __mhrCore?: CoreState };

function state(): CoreState {
  if (!g.__mhrCore) {
    g.__mhrCore = {
      proc: null,
      procPid: null,
      manualStop: false,
      status: "stopped",
      startedAt: null,
      lastError: null,
      exitCode: null,
      logs: [],
      version: null,
      lastBuild: null,
      runningConfig: null,
      syncTimer: null,
      statsTimer: null,
      lastPollAt: null,
      prevTotals: null,
      lastEmailToUser: new Map(),
      lastSnapshot: null,
      overQuotaNotified: new Set(),
      restartAttempts: 0,
      versionLoading: null,
    };
  }
  return g.__mhrCore;
}

const MAX_LOG_LINES = 250;

function pushLog(line: string): void {
  const s = state();
  const clean = line.replace(/\s+$/, "");
  if (!clean) return;
  s.logs.push(clean);
  if (s.logs.length > MAX_LOG_LINES) s.logs.splice(0, s.logs.length - MAX_LOG_LINES);
}

// ---------- نسخه هسته ----------

export async function getCoreVersion(): Promise<string | null> {
  const s = state();
  if (s.version) return s.version;
  if (!binExists()) return null;
  if (!s.versionLoading) {
    s.versionLoading = (async () => {
      try {
        const { stdout } = await exec(XRAY_BIN, ["version"], { timeout: 8000 });
        const m = stdout.match(/Xray\s+(\d+\.\d+\.\d+)/);
        const v = m ? m[1] : stdout.split("\n")[0]?.trim() || null;
        state().version = v;
        return v;
      } catch {
        return null;
      } finally {
        state().versionLoading = null;
      }
    })();
  }
  return s.versionLoading;
}

export function binExists(): boolean {
  return existsSync(XRAY_BIN);
}

// ---------- ساخت و اجرا ----------

async function buildAndWrite(): Promise<BuiltConfig> {
  const built = await buildConfig();
  await writeConfig(built.config);
  state().lastBuild = built;
  return built;
}

export async function startCore(): Promise<{ ok: boolean; error?: string }> {
  const s = state();
  if (s.status === "running" || s.status === "starting") return { ok: true };

  if (!binExists()) {
    s.status = "error";
    s.lastError = "باینری هسته پیدا نشد؛ ابتدا «core:fetch» را اجرا کنید";
    return { ok: false, error: s.lastError };
  }

  try {
    const built = await buildAndWrite();
    if (built.issues.length) {
      for (const issue of built.issues) pushLog(`[mhr] ${issue}`);
    }
  } catch (e) {
    s.status = "error";
    s.lastError = `ساخت کانفیگ ناموفق بود: ${(e as Error).message}`;
    return { ok: false, error: s.lastError };
  }

  s.manualStop = false;
  s.restartAttempts = 0;
  s.status = "starting";
  s.lastError = null;
  pushLog("[mhr] در حال اجرای هسته…");

  const proc = spawn(XRAY_BIN, ["run", "-c", "runtime/config.json"], {
    cwd: CORE_DIR,
    stdio: ["ignore", "pipe", "pipe"],
  });

  s.proc = proc;
  s.procPid = proc.pid ?? null;
  s.startedAt = Date.now();

  proc.stdout?.on("data", (d: Buffer) => {
    for (const line of d.toString().split("\n")) pushLog(line);
  });
  proc.stderr?.on("data", (d: Buffer) => {
    for (const line of d.toString().split("\n")) pushLog(`[err] ${line}`);
  });

  proc.on("error", (err) => {
    const st = state();
    st.status = "error";
    st.lastError = `اجرای هسته ناموفق بود: ${err.message}`;
    pushLog(`[mhr] ${st.lastError}`);
  });

  proc.on("exit", (code) => {
    const st = state();
    st.exitCode = code ?? null;
    st.proc = null;
    st.procPid = null;
    if (st.statsTimer) {
      clearInterval(st.statsTimer);
      st.statsTimer = null;
    }
    st.lastSnapshot = null;
    st.prevTotals = null;

    if (st.manualStop) {
      st.status = "stopped";
      pushLog("[mhr] هسته متوقف شد");
      return;
    }

    st.status = "error";
    const tail = st.logs.slice(-3).join(" | ");
    st.lastError = `هسته به‌طور غیرمنتظره متوقف شد (کد ${code ?? "—"})`;
    pushLog(`[mhr] ${st.lastError}${tail ? ` · ${tail}` : ""}`);

    // تلاش خودکار برای راه‌اندازی مجدد (حداکثر دو بار)
    if (st.restartAttempts < 2 && !st.manualStop) {
      st.restartAttempts += 1;
      pushLog(`[mhr] تلاش مجدد ${st.restartAttempts.toLocaleString("fa-IR")} از ۲…`);
      setTimeout(() => {
        void startCore();
      }, 3000);
    } else {
      void logActivity("warn", "هسته ترافیک متوقف شد و تلاش مجدد ناموفق بود");
    }
  });

  // چند لحظه صبر و بررسی سلامت از طریق API آمار
  await new Promise((r) => setTimeout(r, 900));
  if (s.proc && s.proc.exitCode === null && !s.lastError) {
    s.status = "running";
    pushLog("[mhr] هسته در حال اجراست");
    startStatsPolling();
    return { ok: true };
  }

  if (s.status === "starting") {
    s.status = "error";
    if (!s.lastError) s.lastError = "هسته بلافاصله پس از اجرا خارج شد؛ لاگ‌ها را بررسی کنید";
  }
  return { ok: false, error: s.lastError ?? "اجرای هسته ناموفق بود" };
}

export async function stopCore(): Promise<void> {
  const s = state();
  s.manualStop = true;
  s.restartAttempts = 0;
  if (s.syncTimer) {
    clearTimeout(s.syncTimer);
    s.syncTimer = null;
  }
  if (s.statsTimer) {
    clearInterval(s.statsTimer);
    s.statsTimer = null;
  }
  const proc = s.proc;
  if (proc && proc.exitCode === null) {
    proc.kill("SIGTERM");
    // اگر بعد از ۳ ثانیه نمرده، اجبار
    setTimeout(() => {
      if (proc.exitCode === null) proc.kill("SIGKILL");
    }, 3000);
  }
  s.status = "stopped";
  s.startedAt = null;
  s.lastSnapshot = null;
  pushLog("[mhr] توقف هسته توسط مدیر");
}

export async function restartCore(): Promise<{ ok: boolean; error?: string }> {
  const s = state();
  if (s.proc && s.proc.exitCode === null) {
    await stopCore();
    await new Promise((r) => setTimeout(r, 600));
  }
  s.manualStop = false;
  return startCore();
}

// ---------- همگام‌سازی کانفیگ با دیتابیس ----------

function autoStartEnabled(): Promise<boolean> {
  return getSetting("coreAutoStart").then((v) => v !== "false");
}

async function performSync(reason: string): Promise<void> {
  const s = state();
  try {
    const built = await buildConfig();
    const next = JSON.stringify(built.config);
    await writeConfig(built.config);
    s.lastBuild = built;

    if (s.status === "running" && next !== s.runningConfig) {
      s.runningConfig = next;
      pushLog(`[mhr] همگام‌سازی کانفیگ (${reason})`);
      await restartCore();
      await logActivity("core", `کانفیگ هسته به‌روزرسانی شد (${reason})`);
    } else if (s.status !== "running" && (await autoStartEnabled())) {
      s.runningConfig = next;
      await startCore();
    } else {
      s.runningConfig = next;
    }
  } catch (e) {
    pushLog(`[mhr] همگام‌سازی ناموفق: ${(e as Error).message}`);
  }
}

// فراخوانی از مسیرهای API بعد از هر تغییر کاربر/اینباند (با تاخیر کوتاه برای تجمیع)
export function syncCore(reason = "تغییر تنظیمات"): void {
  const s = state();
  if (s.syncTimer) clearTimeout(s.syncTimer);
  s.syncTimer = setTimeout(() => {
    s.syncTimer = null;
    void performSync(reason);
  }, 600);
}

// اجرای خودکار هستن هنگام بوت سرور (از instrumentation)
export async function bootstrapCore(): Promise<void> {
  if (process.env.MHR_CORE_DISABLE === "1") return;
  if (!binExists()) return;
  if (!(await autoStartEnabled())) return;
  const s = state();
  if (s.status === "running" || s.status === "starting") return;
  try {
    const built = await buildAndWrite();
    s.runningConfig = JSON.stringify(built.config);
    await startCore();
    await logActivity("core", "هسته ترافیک به‌صورت خودکار اجرا شد");
  } catch {
    // بوت پنل نباید به‌خاطر هسته شکسته شود
  }
}

// ---------- جمع‌آوری آمار ----------

const POLL_INTERVAL_MS = 5000;

async function queryStats(): Promise<Array<{ name: string; value: number }> | null> {
  try {
    const { stdout } = await exec(XRAY_BIN, ["api", "statsquery", "--server", API_ADDR], {
      timeout: 4000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const data = JSON.parse(stdout) as { stat?: Array<{ name: string; value: number | string }> };
    return (data.stat ?? []).map((s) => ({ name: s.name, value: Number(s.value) || 0 }));
  } catch {
    return null;
  }
}

function startStatsPolling(): void {
  const s = state();
  if (s.statsTimer) return;
  s.statsTimer = setInterval(() => void pollStats(), POLL_INTERVAL_MS);
  void pollStats();
}

async function pollStats(): Promise<void> {
  const s = state();
  if (s.status !== "running") return;

  const stats = await queryStats();
  if (!stats) return;

  const now = Date.now();
  const usersLive = new Map<string, { up: number; down: number }>();
  const inboundLive = new Map<string, { up: number; down: number }>();
  let totalUp = 0;
  let totalDown = 0;

  const emailToUser = new Map<string, string>();
  try {
    const users = await db.panelUser.findMany({ select: { id: true, uuid: true } });
    for (const u of users) {
      if (u.uuid) emailToUser.set(`mhr-${u.id}`, u.id);
    }
    s.lastEmailToUser = emailToUser;
  } catch {
    return;
  }

  for (const st of stats) {
    if (st.name.startsWith("user>>>")) {
      // user>>>EMAIL>>>traffic>>>uplink|downlink
      const parts = st.name.split(">>>");
      const email = parts[1];
      const kind = parts[3];
      if (!email) continue;
      const userId = emailToUser.get(email);
      if (!userId) continue;
      const cur = usersLive.get(userId) ?? { up: 0, down: 0 };
      if (kind === "uplink") cur.up += st.value;
      else if (kind === "downlink") cur.down += st.value;
      usersLive.set(userId, cur);
    } else if (st.name.startsWith("inbound>>>")) {
      const parts = st.name.split(">>>");
      const tag = parts[1];
      const kind = parts[3];
      if (!tag || tag === "mhr-api") continue;
      const cur = inboundLive.get(tag) ?? { up: 0, down: 0 };
      if (kind === "uplink") cur.up += st.value;
      else if (kind === "downlink") cur.down += st.value;
      inboundLive.set(tag, cur);
      if (kind === "uplink") totalUp += st.value;
      else if (kind === "downlink") totalDown += st.value;
    }
  }

  // نرخ لحظه‌ای
  let rates = { up: 0, down: 0 };
  if (s.prevTotals && s.lastPollAt) {
    const dt = Math.max(1, (now - s.lastPollAt) / 1000);
    rates = {
      up: Math.max(0, (totalUp - s.prevTotals.up) / dt),
      down: Math.max(0, (totalDown - s.prevTotals.down) / dt),
    };
  }
  s.prevTotals = { up: totalUp, down: totalDown };
  s.lastPollAt = now;

  // ثبت دلتای مصرف هر کاربر در دیتابیس (کاهش‌ها پس از ری‌استارت نادیده گرفته می‌شوند)
  for (const [userId, live] of usersLive) {
    const prev = s.lastSnapshot?.users.get(userId);
    if (!prev) continue;
    const delta = Math.max(0, live.up + live.down - (prev.up + prev.down));
    if (delta > 0) {
      try {
        await db.panelUser.update({ where: { id: userId }, data: { usedBytes: { increment: delta } } });
      } catch {
        // کاربر شاید حذف شده باشد
      }
    }
  }

  s.lastSnapshot = {
    totals: { up: totalUp, down: totalDown },
    rates,
    users: usersLive,
    inboundTags: inboundLive,
  };

  await checkExclusionsAndReset();
}

// پس از هر نمونه‌گیری: اگر کاربری از سهمیه گذشت یا منقضی شد، از هسته حذف شود
async function checkExclusionsAndReset(): Promise<void> {
  const s = state();
  try {
    const users = await db.panelUser.findMany();

    for (const u of users) {
      const overQuota = !u.unlimited && u.quotaBytes > 0 && u.usedBytes >= u.quotaBytes;
      if (overQuota && u.active && !s.overQuotaNotified.has(u.id)) {
        s.overQuotaNotified.add(u.id);
        await logActivity("warn", `سهمیه کاربر «${u.name}» به پایان رسید`, { id: u.id });
      }
      if (!overQuota) s.overQuotaNotified.delete(u.id);
    }

    await performSyncIfEligibilityChanged();
    await maybeMonthlyReset();
  } catch {
    // آمار نباید جریان اصلی را بشکند
  }
}

let lastEligibleSig: string | null = null;

async function performSyncIfEligibilityChanged(): Promise<void> {
  const users = await db.panelUser.findMany({ select: { id: true, active: true, unlimited: true, quotaBytes: true, usedBytes: true, expiresAt: true } });
  const sig = users
    .filter((u) => isUserEligible(u))
    .map((u) => u.id)
    .sort()
    .join(",");
  if (lastEligibleSig === null) {
    lastEligibleSig = sig;
    return;
  }
  if (sig !== lastEligibleSig) {
    lastEligibleSig = sig;
    await performSync("تغییر وضعیت کاربران");
  }
}

// ریست ماهانه مصرف بر اساس تنظیم resetDay
async function maybeMonthlyReset(): Promise<void> {
  const resetDayRaw = Number((await getSetting("resetDay")) || "1");
  const resetDay = Math.min(28, Math.max(1, Number.isFinite(resetDayRaw) ? resetDayRaw : 1));
  const lastRaw = await getSetting("lastTrafficReset");

  const now = new Date();
  const due = now.getDate() >= resetDay;
  if (!due) return;

  const last = lastRaw ? new Date(lastRaw) : null;
  if (last) {
    const sameCycle =
      last.getUTCFullYear() === now.getUTCFullYear() &&
      last.getUTCMonth() === now.getUTCMonth() &&
      last.getUTCDate() >= resetDay;
    if (sameCycle) return;
  }

  await db.panelUser.updateMany({ data: { usedBytes: 0 } });
  await setSetting("lastTrafficReset", now.toISOString());
  state().overQuotaNotified.clear();
  lastEligibleSig = null;
  await logActivity("system", `مصرف همه کاربران در روز ${resetDay} هر ماه صفر شد`);
  await performSync("ریست ماهانه ترافیک");
}

// ---------- وضعیت برای API ----------

export type CoreSnapshot = {
  status: CoreStatus;
  pid: number | null;
  version: string | null;
  startedAt: number | null;
  uptimeSec: number;
  lastError: string | null;
  exitCode: number | null;
  binExists: boolean;
  binPath: string;
  apiPort: number;
  logs: string[];
  totals: { up: number; down: number };
  rates: { up: number; down: number };
  inbounds: Array<{
    id: string;
    name: string;
    protocol: string;
    port: number;
    tlsEnabled: boolean;
    fragmentEnabled: boolean;
    userCount: number;
    liveUp: number;
    liveDown: number;
  }>;
  users: Array<{
    id: string;
    name: string;
    usedBytes: number;
    liveUp: number;
    liveDown: number;
    eligible: boolean;
  }>;
  issues: string[];
};

export async function getCoreSnapshot(): Promise<CoreSnapshot> {
  const s = state();
  const version = await getCoreVersion();

  let build = s.lastBuild;
  if (!build) {
    try {
      build = await buildConfig();
    } catch {
      build = { config: {}, inbounds: [], users: [], issues: [] };
    }
  }

  const liveByTag = s.lastSnapshot?.inboundTags ?? new Map();
  const liveByUser = s.lastSnapshot?.users ?? new Map();

  const dbUsers = await db.panelUser.findMany({ orderBy: { createdAt: "desc" } });
  const liveUsers = build.users;
  const eligibleIds = new Set(dbUsers.filter((u) => isUserEligible(u)).map((u) => u.id));

  return {
    status: s.status,
    pid: s.procPid,
    version,
    startedAt: s.startedAt,
    uptimeSec: s.startedAt ? Math.floor((Date.now() - s.startedAt) / 1000) : 0,
    lastError: s.lastError,
    exitCode: s.exitCode,
    binExists: binExists(),
    binPath: XRAY_BIN,
    apiPort: API_PORT,
    logs: s.logs.slice(-120),
    totals: s.lastSnapshot?.totals ?? { up: 0, down: 0 },
    rates: s.lastSnapshot?.rates ?? { up: 0, down: 0 },
    inbounds: build.inbounds.map((i) => ({
      id: i.id,
      name: i.name,
      protocol: i.protocol,
      port: i.port,
      tlsEnabled: i.tlsEnabled,
      fragmentEnabled: i.fragmentEnabled,
      userCount: i.userCount,
      liveUp: liveByTag.get(i.tag)?.up ?? 0,
      liveDown: liveByTag.get(i.tag)?.down ?? 0,
    })),
    users: dbUsers.map((u) => {
      const live = liveByUser.get(u.id);
      return {
        id: u.id,
        name: u.name,
        usedBytes: u.usedBytes,
        liveUp: live?.up ?? 0,
        liveDown: live?.down ?? 0,
        eligible: eligibleIds.has(u.id),
      };
    }),
    issues: build.issues,
  };
}
