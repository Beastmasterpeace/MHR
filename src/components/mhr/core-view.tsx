"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CircleStop,
  Cpu,
  FileTerminal,
  Loader2,
  Play,
  RefreshCw,
  RotateCw,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { api } from "@/lib/client-api";
import { formatBytes, formatUptime } from "@/lib/format";
import type { CoreSnapshot } from "@/lib/types";

const STATUS_META: Record<CoreSnapshot["status"], { label: string; classes: string; dot: string }> = {
  running: {
    label: "در حال اجرا",
    classes: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  starting: {
    label: "در حال راه‌اندازی",
    classes: "border-amber-500/40 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500 animate-pulse",
  },
  stopped: {
    label: "متوقف",
    classes: "text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  error: {
    label: "خطا",
    classes: "border-destructive/40 text-destructive",
    dot: "bg-destructive",
  },
};

function RateItem({
  icon: Icon,
  label,
  bytes,
}: {
  icon: typeof ArrowDownToLine;
  label: string;
  bytes: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border px-4 py-3">
      <span className="rounded-lg bg-accent p-2">
        <Icon className="size-4 text-accent-foreground" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold tabular-nums" dir="ltr">
          {formatBytes(bytes)}/s
        </p>
      </div>
    </div>
  );
}

export function CoreView() {
  const queryClient = useQueryClient();
  const core = useQuery({
    queryKey: ["core"],
    queryFn: () => api.get<CoreSnapshot>("/api/core"),
    refetchInterval: 4000,
  });

  const control = useMutation({
    mutationFn: (action: "start" | "stop" | "restart") => api.post("/api/core", { action }),
    onSuccess: (_data, action) => {
      toastCoreAction(action);
      queryClient.invalidateQueries({ queryKey: ["core"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
    onError: (e: Error) => toastError(e),
  });

  const d = core.data;
  const statusMeta = d ? STATUS_META[d.status] : null;
  const busy = control.isPending;

  function toastCoreAction(action: "start" | "stop" | "restart") {
    const map = {
      start: "اجرای هسته درخواست شد",
      stop: "توقف هسته درخواست شد",
      restart: "ری‌استارت هسته انجام شد",
    };
    toast.success(map[action]);
  }

  function toastError(e: Error) {
    toast.error(e.message);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {!core.isLoading && d && !d.binExists && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
          <TriangleAlert className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            باینری هسته پیدا نشد. برای دانلود خودکار Xray-core دستور <code dir="ltr">bun run core:fetch</code> را اجرا
            کنید.
          </span>
        </div>
      )}

      {d?.lastError && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <TriangleAlert className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{d.lastError}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* وضعیت هسته */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Boxes className="size-4 text-primary" aria-hidden="true" />
                وضعیت هسته ترافیک
              </span>
              {statusMeta && (
                <Badge variant="outline" className={statusMeta.classes}>
                  <span className={`size-1.5 rounded-full ${statusMeta.dot} me-1.5`} aria-hidden="true" />
                  {statusMeta.label}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              هسته بر پایه Xray اجرا می‌شود و کانفیگ آن به‌صورت خودکار از پنل ساخته می‌شود.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {core.isLoading || !d ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-5 rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <dl className="grid grid-cols-[auto_1fr] gap-y-2.5 gap-x-4 text-sm items-center">
                  <dt className="text-muted-foreground">نسخه Xray</dt>
                  <dd className="font-medium" dir="ltr">{d.version ?? "—"}</dd>
                  <dt className="text-muted-foreground">شناسه فرایند</dt>
                  <dd className="font-medium tabular-nums" dir="ltr">{d.pid ?? "—"}</dd>
                  <dt className="text-muted-foreground">مدت کارکرد</dt>
                  <dd className="font-medium">{d.status === "running" ? formatUptime(d.uptimeSec) : "—"}</dd>
                  <dt className="text-muted-foreground">پورت API آمار</dt>
                  <dd className="font-medium tabular-nums" dir="ltr">{d.apiPort}</dd>
                </dl>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => control.mutate("start")}
                    disabled={busy || d.status === "running" || !d.binExists}
                  >
                    {control.isPending && control.variables === "start" ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Play className="size-4" aria-hidden="true" />
                    )}
                    اجرا
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => control.mutate("restart")}
                    disabled={busy || d.status !== "running"}
                  >
                    {control.isPending && control.variables === "restart" ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <RotateCw className="size-4" aria-hidden="true" />
                    )}
                    ری‌استارت
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => control.mutate("stop")}
                    disabled={busy || d.status === "stopped"}
                  >
                    <CircleStop className="size-4" aria-hidden="true" />
                    توقف
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="size-8 p-0"
                    onClick={() => core.refetch()}
                    aria-label="به‌روزرسانی وضعیت"
                  >
                    <RefreshCw className={`size-4 ${core.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
                  </Button>
                </div>
                {d.issues.length > 0 && (
                  <ul className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground space-y-1">
                    {d.issues.map((issue, i) => (
                      <li key={i}>• {issue}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ترافیک زنده */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="size-4 text-primary" aria-hidden="true" />
              ترافیک زنده
            </CardTitle>
            <CardDescription>مجموع اینباند‌های فعال از شروع آخرین اجرای هسته</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <RateItem icon={ArrowDownToLine} label="نرخ دانلود" bytes={d?.rates.down ?? 0} />
              <RateItem icon={ArrowUpFromLine} label="نرخ آپلود" bytes={d?.rates.up ?? 0} />
            </div>
            <div className="text-xs text-muted-foreground tabular-nums" dir="ltr">
              total ↓ {formatBytes(d?.totals.down ?? 0)} · ↑ {formatBytes(d?.totals.up ?? 0)}
            </div>
            {d && d.inbounds.length > 0 ? (
              <div className="rounded-xl border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>اینباند</TableHead>
                      <TableHead>پروتکل</TableHead>
                      <TableHead>پورت</TableHead>
                      <TableHead>کاربران</TableHead>
                      <TableHead>↓</TableHead>
                      <TableHead>↑</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.inbounds.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" dir="ltr">{i.protocol}</Badge>
                        </TableCell>
                        <TableCell className="tabular-nums" dir="ltr">{i.port}</TableCell>
                        <TableCell className="tabular-nums">{i.userCount.toLocaleString("fa-IR")}</TableCell>
                        <TableCell className="tabular-nums" dir="ltr">{formatBytes(i.liveDown)}</TableCell>
                        <TableCell className="tabular-nums" dir="ltr">{formatBytes(i.liveUp)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              !core.isLoading && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  هنوز اینباندی ساخته نشده؛ از بخش «اینباندها» اولین ورودی ترافیک را بسازید.
                </p>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* مصرف کاربران */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">مصرف کاربران</CardTitle>
          <CardDescription>مجموع کل ذخیره‌شده در پنل و آمار زنده از آخرین اجرای هسته</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {core.isLoading || !d ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-8 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : d.users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">هنوز کاربری ثبت نشده است.</p>
          ) : (
            <div className="rounded-xl border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>کاربر</TableHead>
                    <TableHead>مصرف کل</TableHead>
                    <TableHead>↓ از آخرین اجرا</TableHead>
                    <TableHead>↑ از آخرین اجرا</TableHead>
                    <TableHead>وضعیت در هسته</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="tabular-nums" dir="ltr">{formatBytes(u.usedBytes)}</TableCell>
                      <TableCell className="tabular-nums" dir="ltr">{formatBytes(u.liveDown)}</TableCell>
                      <TableCell className="tabular-nums" dir="ltr">{formatBytes(u.liveUp)}</TableCell>
                      <TableCell>
                        {u.eligible ? (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                            در هسته
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            خارج از هسته
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* لاگ هسته */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileTerminal className="size-4 text-primary" aria-hidden="true" />
            لاگ هسته
          </CardTitle>
          <CardDescription>۱۲۰ خط آخر — هر ۴ ثانیه به‌روزرسانی می‌شود</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {core.isLoading || !d ? (
            <div className="h-48 rounded-xl bg-muted animate-pulse" />
          ) : d.logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">لاگی ثبت نشده است.</p>
          ) : (
            <pre
              dir="ltr"
              className="max-h-80 overflow-y-auto rounded-xl bg-zinc-950 text-zinc-100 p-4 text-xs leading-5 font-mono whitespace-pre-wrap"
            >
              {d.logs.join("\n")}
            </pre>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
