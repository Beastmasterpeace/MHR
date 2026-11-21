// قالب‌بندی اعداد و تاریخ‌ها برای نمایش

export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  const d = value >= 100 || i === 0 ? 0 : digits;
  return `${value.toFixed(d)} ${units[i]}`;
}

export function formatPercent(p: number): string {
  return `${(Math.round(p * 10) / 10).toLocaleString("fa-IR")}٪`;
}

export function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d.toLocaleString("fa-IR")} روز`);
  if (h) parts.push(`${h.toLocaleString("fa-IR")} ساعت`);
  parts.push(`${m.toLocaleString("fa-IR")} دقیقه`);
  return parts.join(" و ");
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export function quotaState(user: {
  active: boolean;
  unlimited: boolean;
  usedBytes: number;
  quotaBytes: number;
  expiresAt: string | null;
}): "active" | "expired" | "quota" | "disabled" {
  if (!user.active) return "disabled";
  if (user.expiresAt && new Date(user.expiresAt).getTime() < Date.now()) return "expired";
  if (!user.unlimited && user.quotaBytes > 0 && user.usedBytes >= user.quotaBytes) return "quota";
  return "active";
}

export const quotaStateLabels: Record<string, string> = {
  active: "فعال",
  expired: "منقضی",
  quota: "اتمام حجم",
  disabled: "غیرفعال",
};
