import os from "os";
import { readFileSync } from "fs";
import { statfs } from "fs/promises";
import type { SystemStats } from "@/lib/types";

// آمار واقعی سیستمِ میزبان؛ مقدار CPU از اختلاف دو نمونه‌گیری محاسبه می‌شود.

let prevCpuSnapshot = cpuSnapshot();

function cpuSnapshot(): { idle: number; total: number } {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    idle += cpu.times.idle;
    total += cpu.times.idle + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq;
  }
  return { idle, total };
}

function cpuPercent(): number {
  const now = cpuSnapshot();
  const dTotal = now.total - prevCpuSnapshot.total;
  const dIdle = now.idle - prevCpuSnapshot.idle;
  prevCpuSnapshot = now;
  if (dTotal <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(((dTotal - dIdle) / dTotal) * 1000) / 10));
}

function readSwap(): { total: number; used: number } {
  try {
    const meminfo = readFileSync("/proc/meminfo", "utf8");
    const total = Number(/SwapTotal:\s+(\d+)\s*kB/.exec(meminfo)?.[1] ?? 0) * 1024;
    const free = Number(/SwapFree:\s+(\d+)\s*kB/.exec(meminfo)?.[1] ?? 0) * 1024;
    return { total, used: Math.max(0, total - free) };
  } catch {
    return { total: 0, used: 0 };
  }
}

export async function getSystemStats(): Promise<SystemStats> {
  const cpus = os.cpus();
  const ramTotal = os.totalmem();
  const ramFree = os.freemem();
  const ramUsed = Math.max(0, ramTotal - ramFree);
  const swap = readSwap();

  let diskTotal = 0;
  let diskFree = 0;
  try {
    const st = await statfs(process.cwd());
    diskTotal = Number(st.blocks) * Number(st.bsize);
    diskFree = Number(st.bfree) * Number(st.bsize);
  } catch {
    // دسترسی به statfs ممکن نبود
  }
  const diskUsed = Math.max(0, diskTotal - diskFree);

  return {
    cpuPercent: cpuPercent(),
    cpuCores: cpus.length,
    cpuModel: cpus[0]?.model?.trim() ?? "نامشخص",
    ram: {
      total: ramTotal,
      used: ramUsed,
      percent: ramTotal ? Math.round((ramUsed / ramTotal) * 1000) / 10 : 0,
    },
    swap: {
      total: swap.total,
      used: swap.used,
      percent: swap.total ? Math.round((swap.used / swap.total) * 1000) / 10 : 0,
    },
    disk: {
      total: diskTotal,
      used: diskUsed,
      percent: diskTotal ? Math.round((diskUsed / diskTotal) * 1000) / 10 : 0,
    },
    uptimeSec: Math.floor(os.uptime()),
    hostname: os.hostname(),
    platform: process.platform,
    arch: os.arch(),
    nodeVersion: process.version,
    loadavg: os.loadavg().map((n) => Math.round(n * 100) / 100),
  };
}
