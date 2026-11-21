"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowUpDown,
  Cpu,
  Globe,
  HardDrive,
  Info,
  KeyRound,
  ListChecks,
  MemoryStick,
  Network,
  Orbit,
  RefreshCw,
  Settings2,
  TriangleAlert,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client-api";
import { formatBytes, formatUptime } from "@/lib/format";
import type { ActivityEntry, Inbound, PanelUser, SystemStats } from "@/lib/types";

function StatCard({
  title,
  icon: Icon,
  percent,
  detail,
  delay,
}: {
  title: string;
  icon: typeof Cpu;
  percent: number;
  detail: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
    >
      <Card className="card-hover overflow-hidden">
        <div className="h-1 brand-gradient" aria-hidden="true" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="rounded-lg bg-accent p-1.5">
                <Icon className="size-4 text-accent-foreground" aria-hidden="true" />
              </span>
              {title}
            </div>
            <span className="text-xl font-bold tabular-nums">{percent.toLocaleString("fa-IR")}٪</span>
          </div>
          <Progress value={Math.min(100, percent)} className="mt-4 h-2" aria-label={`مصرف ${title}`} />
          <p className="mt-2 text-xs text-muted-foreground tabular-nums">{detail}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

const TYPE_META: Record<string, { label: string; icon: typeof Info; classes: string }> = {
  auth: { label: "احراز هویت", icon: KeyRound, classes: "bg-accent text-accent-foreground" },
  user: { label: "کاربران", icon: UserPlus, classes: "bg-accent text-accent-foreground" },
  inbound: { label: "اینباند", icon: Network, classes: "bg-accent text-accent-foreground" },
  core: { label: "هسته ترافیک", icon: Orbit, classes: "bg-accent text-accent-foreground" },
  system: { label: "سیستم", icon: Settings2, classes: "bg-accent text-accent-foreground" },
  warn: { label: "هشدار", icon: TriangleAlert, classes: "bg-destructive/10 text-destructive" },
  info: { label: "رویداد", icon: Info, classes: "bg-muted text-muted-foreground" },
};

export function DashboardView() {
  const system = useQuery({
    queryKey: ["system"],
    queryFn: () => api.get<SystemStats>("/api/system"),
    refetchInterval: 4000,
  });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<{ users: PanelUser[] }>("/api/users"),
    refetchInterval: 15000,
  });
  const inbounds = useQuery({
    queryKey: ["inbounds"],
    queryFn: () => api.get<{ inbounds: Inbound[] }>("/api/inbounds"),
    refetchInterval: 15000,
  });
  const activity = useQuery({
    queryKey: ["activity", 6],
    queryFn: () => api.get<{ entries: ActivityEntry[] }>("/api/activity?limit=6"),
    refetchInterval: 10000,
  });

  const s = system.data;
  const activeUsers = users.data?.users.filter((u) => u.active).length ?? 0;
  const activeInbounds = inbounds.data?.inbounds.filter((i) => i.enabled).length ?? 0;

  return (
    <div className="space-y-6">
      {/* کارت‌های منابع */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {system.isLoading || !s ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)
        ) : (
          <>
            <StatCard title="پردازنده" icon={Cpu} percent={s.cpuPercent} detail={`${s.cpuCores.toLocaleString("fa-IR")} هسته · ${s.cpuModel}`} delay={0} />
            <StatCard title="حافظه رم" icon={MemoryStick} percent={s.ram.percent} detail={`${formatBytes(s.ram.used)} از ${formatBytes(s.ram.total)}`} delay={0.05} />
            <StatCard title="سواپ" icon={Network} percent={s.swap.percent} detail={s.swap.total ? `${formatBytes(s.swap.used)} از ${formatBytes(s.swap.total)}` : "سواپ غیرفعال"} delay={0.1} />
            <StatCard title="فضای ذخیره‌سازی" icon={HardDrive} percent={s.disk.percent} detail={`${formatBytes(s.disk.used)} از ${formatBytes(s.disk.total)}`} delay={0.15} />
          </>
        )}
      </div>

      {/* شمارنده‌ها */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "کل کاربران", value: (users.data?.users.length ?? 0).toLocaleString("fa-IR"), icon: Users, hint: `${activeUsers.toLocaleString("fa-IR")} فعال` },
          { label: "اینباندها", value: (inbounds.data?.inbounds.length ?? 0).toLocaleString("fa-IR"), icon: Globe, hint: `${activeInbounds.toLocaleString("fa-IR")} فعال` },
          {
            label: "ترافیک ثبت‌شده",
            value: formatBytes((users.data?.users ?? []).reduce((a, u) => a + u.usedBytes, 0)),
            icon: ArrowUpDown,
            hint: "مجموع مصرف مشترکین",
          },
          { label: "رویدادهای ثبت‌شده", value: (activity.data?.entries.length ?? 0).toLocaleString("fa-IR"), icon: ListChecks, hint: "در لاگ فعالیت" },
        ].map((c) => (
          <Card key={c.label} className="card-hover">
            <CardContent className="p-5 flex items-center gap-4">
              <span className="rounded-xl bg-accent p-2.5">
                <c.icon className="size-5 text-accent-foreground" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-bold tabular-nums">{c.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.label} · {c.hint}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* اطلاعات میزبان */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              اطلاعات میزبان
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => system.refetch()}
                aria-label="به‌روزرسانی آمار"
              >
                <RefreshCw className={`size-4 ${system.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {system.isLoading || !s ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 rounded-md" />
                ))}
              </div>
            ) : (
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-y-3 gap-x-4 text-sm items-center">
                <dt className="text-muted-foreground">نام میزبان</dt>
                <dd className="font-medium truncate" dir="ltr">{s.hostname}</dd>
                <dt className="text-muted-foreground">سیستم</dt>
                <dd className="font-medium truncate" dir="ltr">{s.platform} · {s.arch}</dd>
                <dt className="text-muted-foreground">نسخه Node</dt>
                <dd className="font-medium truncate" dir="ltr">{s.nodeVersion}</dd>
                <dt className="text-muted-foreground">مدت کارکرد</dt>
                <dd className="font-medium">{formatUptime(s.uptimeSec)}</dd>
                <dt className="text-muted-foreground">بار سیستم</dt>
                <dd className="font-medium tabular-nums truncate" dir="ltr">{s.loadavg.join("  ·  ")}</dd>
              </dl>
            )}
          </CardContent>
        </Card>

        {/* آخرین رویدادها */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">آخرین رویدادها</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {activity.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 rounded-md" />
                ))}
              </div>
            ) : !activity.data?.entries.length ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                هنوز رویدادی ثبت نشده است.
              </p>
            ) : (
              <ul className="max-h-56 overflow-y-auto space-y-1 pe-1">
                {activity.data.entries.map((e) => {
                  const meta = TYPE_META[e.type] ?? TYPE_META.info;
                  const Icon = meta.icon;
                  return (
                    <li key={e.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 text-sm">
                      <span className={`rounded-md p-1.5 shrink-0 ${meta.classes}`}>
                        <Icon className="size-3.5" aria-hidden="true" />
                      </span>
                      <span className="flex-1 min-w-0 truncate">{e.message}</span>
                      <time className="text-xs text-muted-foreground shrink-0 tabular-nums">
                        {new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(new Date(e.createdAt))}
                      </time>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* یادآوری وضعیت */}
      {!system.isLoading && s && s.cpuPercent > 85 && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <TriangleAlert className="size-4" aria-hidden="true" />
          مصرف پردازنده بالاست ({s.cpuPercent.toLocaleString("fa-IR")}٪)؛ وضعیت سرویس‌ها را بررسی کنید.
        </div>
      )}
      {activeUsers === 0 && !users.isLoading && (
        <div className="flex items-center gap-2 rounded-xl border bg-accent/40 px-4 py-3 text-sm text-accent-foreground">
          <Users className="size-4 shrink-0" aria-hidden="true" />
          هنوز کاربری نساخته‌اید. از بخش «کاربران» اولین مشترک را اضافه کنید.
        </div>
      )}
      {activeInbounds === 0 && !inbounds.isLoading && (
        <div className="flex items-center gap-2 rounded-xl border bg-accent/40 px-4 py-3 text-sm text-accent-foreground">
          <Globe className="size-4 shrink-0" aria-hidden="true" />
          هیچ اینباند فعالی وجود ندارد؛ از بخش «اینباندها» یکی بسازید.
          <Badge variant="outline" className="ms-auto">پیشنهاد</Badge>
        </div>
      )}
    </div>
  );
}
