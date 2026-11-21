"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CircleOff, Clock, Copy, FileText, Gauge, Globe, Link2, RefreshCw, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MhrWordmark } from "@/components/mhr/logo";
import { ThemeToggle } from "@/components/mhr/theme-toggle";
import { api } from "@/lib/client-api";
import { daysUntil, formatDate, formatBytes, quotaState, quotaStateLabels } from "@/lib/format";
import type { SubInfo } from "@/lib/types";

export function SubView({ token }: { token: string }) {
  const info = useQuery({
    queryKey: ["sub", token],
    queryFn: () => api.get<SubInfo>(`/api/sub?token=${encodeURIComponent(token)}&format=json`),
    refetchInterval: 20000,
  });

  if (info.isLoading) {
    return (
      <div className="hero-glow min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-4">
          <Skeleton className="h-12 w-44 rounded-xl" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (info.isError) {
    return (
      <div className="hero-glow min-h-screen flex flex-col">
        <header className="flex items-center justify-between p-4 sm:p-6">
          <MhrWordmark compact />
          <ThemeToggle />
        </header>
        <main className="flex-1 flex items-center justify-center px-4 pb-16">
          <Card className="max-w-md w-full text-center">
            <CardContent className="py-12 flex flex-col items-center gap-4 px-6">
              <span className="rounded-2xl bg-destructive/10 p-3">
                <CircleOff className="size-8 text-destructive" aria-hidden="true" />
              </span>
              <p className="font-semibold text-lg">اشتراک یافت نشد</p>
              <p className="text-sm text-muted-foreground leading-6">
                لینک اشتراک نامعتبر است یا اشتراک حذف شده. لینک کامل را از مدیر بگیرید.
              </p>
            </CardContent>
          </Card>
        </main>
        <footer className="mt-auto pb-5 text-center text-xs text-muted-foreground">
          MHR · پنل مدیریت شخصی
        </footer>
      </div>
    );
  }

  const d = info.data!;
  const user = d.user;
  const state = quotaState(user);
  const percent = user.unlimited ? 0 : user.quotaBytes ? Math.min(100, (user.usedBytes / user.quotaBytes) * 100) : 0;
  const remaining = user.unlimited ? 0 : Math.max(0, user.quotaBytes - user.usedBytes);
  const remainingDays = daysUntil(user.expiresAt);
  const pieData =
    user.unlimited || !user.quotaBytes
      ? []
      : [
          { name: "مصرف", value: Math.min(user.usedBytes, user.quotaBytes), fill: "var(--color-primary)" },
          { name: "باقی‌مانده", value: remaining, fill: "color-mix(in oklab, var(--color-primary) 18%, transparent)" },
        ];

  return (
    <div className="hero-glow min-h-screen flex flex-col">
      <header className="flex items-center justify-between p-4 sm:p-6">
        <MhrWordmark compact />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => info.refetch()}
            aria-label="به‌روزرسانی"
          >
            <RefreshCw className={`size-5 ${info.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto px-4 pb-16 space-y-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {/* کارت اصلی مصرف */}
          <Card className="overflow-hidden">
            <div className="h-1.5 brand-gradient" aria-hidden="true" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">اشتراک</p>
                  <h1 className="text-2xl font-bold mt-1" dir="ltr">{user.name}</h1>
                </div>
                <Badge
                  variant="outline"
                  className={
                    state === "active"
                      ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                      : state === "disabled"
                        ? "text-muted-foreground"
                        : "border-amber-500/40 text-amber-600 dark:text-amber-400"
                  }
                >
                  {quotaStateLabels[state]}
                </Badge>
              </div>

              {user.note && (
                <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-muted/60 rounded-lg p-2.5">
                  <FileText className="size-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                  {user.note}
                </p>
              )}

              <div className="mt-6 grid sm:grid-cols-[auto_1fr] gap-6 items-center">
                {/* نمودار دایره‌ای مصرف */}
                <div className="relative size-40 mx-auto sm:mx-0">
                  {user.unlimited || !user.quotaBytes ? (
                    <div className="size-40 rounded-full border-4 border-dashed border-primary/30 flex flex-col items-center justify-center gap-1">
                      <Gauge className="size-7 text-primary" aria-hidden="true" />
                      <span className="text-sm font-semibold">نامحدود</span>
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            innerRadius="78%"
                            outerRadius="100%"
                            strokeWidth={0}
                            startAngle={90}
                            endAngle={-270}
                          >
                            {pieData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-bold tabular-nums">{percent.toLocaleString("fa-IR")}٪</span>
                        <span className="text-[11px] text-muted-foreground">مصرف‌شده</span>
                      </div>
                    </>
                  )}
                </div>

                {/* آمار */}
                <dl className="space-y-3 text-sm w-full">
                  <div className="flex items-center justify-between border-b pb-2.5">
                    <dt className="flex items-center gap-2 text-muted-foreground">
                      <Wifi className="size-4" aria-hidden="true" />
                      حجم مصرف‌شده
                    </dt>
                    <dd className="font-semibold tabular-nums">{formatBytes(user.usedBytes)}</dd>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2.5">
                    <dt className="flex items-center gap-2 text-muted-foreground">
                      <Gauge className="size-4" aria-hidden="true" />
                      حجم کل
                    </dt>
                    <dd className="font-semibold tabular-nums">
                      {user.unlimited ? "نامحدود" : formatBytes(user.quotaBytes)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="size-4" aria-hidden="true" />
                      تاریخ انقضا
                    </dt>
                    <dd className="font-semibold tabular-nums flex flex-col items-end">
                      {user.expiresAt ? (
                        <>
                          {formatDate(user.expiresAt)}
                          {state === "active" && remainingDays !== null && remainingDays >= 0 && (
                            <span className="text-[11px] font-normal text-muted-foreground">
                              {remainingDays.toLocaleString("fa-IR")} روز مانده
                            </span>
                          )}
                        </>
                      ) : (
                        "بدون انقضا"
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* اینباندهای فعال */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }}>
          <Card>
            <CardContent className="p-5">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Globe className="size-4 text-primary" aria-hidden="true" />
                اینباندهای فعال ({d.inbounds.length.toLocaleString("fa-IR")})
              </h2>
              {d.inbounds.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">در حال حاضر اینباند فعالی وجود ندارد.</p>
              ) : (
                <ul className="space-y-2">
                  {d.inbounds.map((i) => (
                    <li key={`${i.name}-${i.port}`} className="flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm">
                      <span className="rounded-lg bg-accent p-1.5">
                        <Globe className="size-3.5 text-accent-foreground" aria-hidden="true" />
                      </span>
                      <span className="font-medium flex-1 min-w-0 truncate">{i.name}</span>
                      <Badge variant="secondary" dir="ltr">{i.protocol}</Badge>
                      <Badge variant="secondary" className="tabular-nums" dir="ltr">:{i.port}</Badge>
                      {i.tlsEnabled && (
                        <Badge variant="outline" className="border-sky-500/40 text-sky-600 dark:text-sky-400">
                          TLS
                        </Badge>
                      )}
                      {i.echEnabled && (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                          ECH
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* لینک‌های کانفیگ */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3 }}>
          <Card>
            <CardContent className="p-5">
              <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
                <Link2 className="size-4 text-primary" aria-hidden="true" />
                لینک‌های کانفیگ
              </h2>
              <p className="text-xs text-muted-foreground mb-3 leading-5">
                هر لینک را در کلاینت (v2rayNG، Nekoray، Hiddings و…) اضافه کنید؛ یا لینک اشتراک کل صفحه را یک‌بار در کلاینت وارد کنید.
              </p>
              {d.links.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">
                  در حال حاضر کانفیگی برای این اشتراک تولید نشده است.
                </p>
              ) : (
                <ul className="space-y-2">
                  {d.links.map((l) => (
                    <li key={l.uri} className="rounded-xl border px-3.5 py-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" dir="ltr">{l.protocol}</Badge>
                        <span className="text-sm font-medium flex-1 min-w-0 truncate" dir="ltr">{l.inboundName}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() =>
                            navigator.clipboard
                              .writeText(l.uri)
                              .then(() => toast.success("لینک کپی شد"))
                              .catch(() => toast.error("کپی ناموفق بود"))
                          }
                          aria-label={`کپی لینک ${l.inboundName}`}
                        >
                          <Copy className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                      <code
                        dir="ltr"
                        className="block text-[10px] leading-4 text-muted-foreground bg-muted/60 rounded-md px-2 py-1.5 break-all"
                      >
                        {l.uri.length > 120 ? `${l.uri.slice(0, 120)}…` : l.uri}
                      </code>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <footer className="mt-auto pb-5 text-center text-xs text-muted-foreground">
        {d.panelName} · صفحه اشتراک شخصی
      </footer>
    </div>
  );
}
