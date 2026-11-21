"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Info, KeyRound, ListChecks, Network, Orbit, RefreshCw, Settings2, Trash2, TriangleAlert, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/client-api";
import { formatDateTime } from "@/lib/format";
import type { ActivityEntry } from "@/lib/types";

const TYPE_META: Record<string, { label: string; icon: typeof Info; classes: string }> = {
  auth: { label: "احراز هویت", icon: KeyRound, classes: "bg-accent text-accent-foreground" },
  user: { label: "کاربران", icon: UserPlus, classes: "bg-accent text-accent-foreground" },
  inbound: { label: "اینباند", icon: Network, classes: "bg-accent text-accent-foreground" },
  core: { label: "هسته ترافیک", icon: Orbit, classes: "bg-accent text-accent-foreground" },
  system: { label: "سیستم", icon: Settings2, classes: "bg-accent text-accent-foreground" },
  warn: { label: "هشدار", icon: TriangleAlert, classes: "bg-destructive/10 text-destructive" },
  info: { label: "رویداد", icon: Info, classes: "bg-muted text-muted-foreground" },
};

export function ActivityView() {
  const queryClient = useQueryClient();
  const entriesQuery = useQuery({
    queryKey: ["activity", 100],
    queryFn: () => api.get<{ entries: ActivityEntry[] }>("/api/activity?limit=100"),
    refetchInterval: 8000,
  });

  const clearMutation = useMutation({
    mutationFn: () => api.delete("/api/activity"),
    onSuccess: () => {
      toast.success("لاگ فعالیت پاک شد");
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const entries = entriesQuery.data?.entries ?? [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {entries.length
            ? `${entries.length.toLocaleString("fa-IR")} رویداد آخر`
            : "رویدادهای پنل به‌ترتیب زمان"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => entriesQuery.refetch()}
            aria-label="به‌روزرسانی"
          >
            <RefreshCw className={`size-4 ${entriesQuery.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
            به‌روزرسانی
          </Button>
          {entries.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="size-4" aria-hidden="true" />
                  پاک‌کردن لاگ
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>پاک‌کردن کل لاگ فعالیت؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    همه رویدادهای ثبت‌شده برای همیشه حذف می‌شوند.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>انصراف</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    disabled={clearMutation.isPending}
                    onClick={() => clearMutation.mutate()}
                  >
                    پاک کردن
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-3">
          {entriesQuery.isLoading ? (
            <div className="p-3 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center px-6">
              <span className="rounded-2xl bg-accent p-3">
                <ListChecks className="size-7 text-accent-foreground" aria-hidden="true" />
              </span>
              <p className="font-medium">لاگ خالی است</p>
              <p className="text-sm text-muted-foreground max-w-sm leading-6">
                رویدادهایی مثل ورود مدیر، ساخت کاربر و تغییر اینباندها اینجا ثبت می‌شوند.
              </p>
            </div>
          ) : (
            <ul className="divide-y max-h-[70vh] overflow-y-auto pe-1">
              {entries.map((e) => {
                const meta = TYPE_META[e.type] ?? TYPE_META.info;
                const Icon = meta.icon;
                return (
                  <li key={e.id} className="flex items-center gap-3 px-2 py-3 text-sm">
                    <span className={`rounded-lg p-2 shrink-0 ${meta.classes}`} title={meta.label}>
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="leading-6">{e.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{meta.label}</p>
                    </div>
                    <time className="text-xs text-muted-foreground shrink-0 tabular-nums">
                      {formatDateTime(e.createdAt)}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
