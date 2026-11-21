"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CalendarClock,
  CircleCheck,
  Copy,
  ExternalLink,
  Fingerprint,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/client-api";
import { daysUntil, formatDate, formatBytes, quotaState, quotaStateLabels } from "@/lib/format";
import type { PanelUser } from "@/lib/types";

type UserFormState = {
  id: string | null;
  name: string;
  note: string;
  unlimited: boolean;
  quotaGb: string;
  hasExpiry: boolean;
  expiryDate: string; // yyyy-mm-dd
};

function emptyForm(): UserFormState {
  return { id: null, name: "", note: "", unlimited: false, quotaGb: "", hasExpiry: false, expiryDate: "" };
}

function toForm(u: PanelUser): UserFormState {
  return {
    id: u.id,
    name: u.name,
    note: u.note ?? "",
    unlimited: u.unlimited,
    quotaGb: u.unlimited ? "" : String(Math.round(u.quotaBytes / 1024 ** 3 * 100) / 100),
    hasExpiry: !!u.expiresAt,
    expiryDate: u.expiresAt ? new Date(u.expiresAt).toISOString().slice(0, 10) : "",
  };
}

export function UsersView() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<UserFormState>(emptyForm());
  const [deleting, setDeleting] = useState<PanelUser | null>(null);

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<{ users: PanelUser[] }>("/api/users"),
    refetchInterval: 15000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post("/api/users", payload),
    onSuccess: () => {
      toast.success("کاربر ساخته شد");
      invalidate();
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.patch(`/api/users/${id}`, payload),
    onSuccess: () => {
      toast.success("کاربر به‌روزرسانی شد");
      invalidate();
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/users/${id}`),
    onSuccess: () => {
      toast.success("کاربر حذف شد");
      invalidate();
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/api/users/${id}`, { active }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(u: PanelUser) {
    setForm(toForm(u));
    setDialogOpen(true);
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      toast.error("نام کاربر حداقل ۲ کاراکتر است");
      return;
    }
    if (!form.unlimited && form.quotaGb && Number(form.quotaGb) < 0) {
      toast.error("حجم نمی‌تواند منفی باشد");
      return;
    }
    const quotaBytes = form.unlimited ? 0 : form.quotaGb ? Number(form.quotaGb) * 1024 ** 3 : 0;
    const expiresAt =
      form.hasExpiry && form.expiryDate
        ? new Date(`${form.expiryDate}T23:59:59`).toISOString()
        : null;

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      note: form.note.trim() || null,
      unlimited: form.unlimited,
      quotaBytes,
      expiresAt,
    };
    if (form.id) updateMutation.mutate({ id: form.id, payload });
    else createMutation.mutate(payload);
  }

  function copySubLink(u: PanelUser) {
    // لینک اشتراک استاندارد برای کلاینت‌ها (خروجی base64)
    const url = `${window.location.origin}/api/sub?token=${u.subToken}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("لینک اشتراک کلاینت کپی شد"))
      .catch(() => toast.error("کپی ناموفق بود"));
  }

  function copyPageLink(u: PanelUser) {
    const url = `${window.location.origin}/?sub=${u.subToken}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("لینک صفحه اشتراک کپی شد"))
      .catch(() => toast.error("کپی ناموفق بود"));
  }

  function copyUuid(u: PanelUser) {
    if (!u.uuid) {
      toast.error("شناسه این کاربر هنوز ساخته نشده است");
      return;
    }
    navigator.clipboard
      .writeText(u.uuid)
      .then(() => toast.success("شناسه UUID کپی شد"))
      .catch(() => toast.error("کپی ناموفق بود"));
  }

  const users = usersQuery.data?.users ?? [];
  const busy = createMutation.isPending || updateMutation.isPending;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {users.length ? `${users.length.toLocaleString("fa-IR")} کاربر ثبت شده` : "مدیریت مشترکین پنل"}
        </p>
        <Button onClick={openCreate}>
          <Plus className="size-4" aria-hidden="true" />
          کاربر جدید
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {usersQuery.isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center px-6">
              <span className="rounded-2xl bg-accent p-3">
                <Users className="size-7 text-accent-foreground" aria-hidden="true" />
              </span>
              <p className="font-medium">هنوز کاربری وجود ندارد</p>
              <p className="text-sm text-muted-foreground max-w-sm leading-6">
                اولین مشترک را با دکمه «کاربر جدید» بسازید؛ برای هر کاربر یک لینک اشتراک یکتا تولید می‌شود.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>کاربر</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead className="min-w-44">مصرف</TableHead>
                    <TableHead className="hidden md:table-cell">انقضا</TableHead>
                    <TableHead>لینک اشتراک</TableHead>
                    <TableHead className="text-start">فعال</TableHead>
                    <TableHead className="text-start">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const state = quotaState(u);
                    const percent = u.unlimited || !u.quotaBytes ? 0 : Math.min(100, (u.usedBytes / u.quotaBytes) * 100);
                    const remainingDays = daysUntil(u.expiresAt);
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="font-medium">{u.name}</div>
                          {u.note && <div className="text-xs text-muted-foreground mt-0.5 max-w-40 truncate">{u.note}</div>}
                        </TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                          <div className="text-xs tabular-nums text-muted-foreground mb-1.5">
                            {u.unlimited
                              ? `${formatBytes(u.usedBytes)} · نامحدود`
                              : u.quotaBytes
                                ? `${formatBytes(u.usedBytes)} از ${formatBytes(u.quotaBytes)}`
                                : `${formatBytes(u.usedBytes)} · بدون سهمیه`}
                          </div>
                          {!u.unlimited && u.quotaBytes > 0 && (
                            <Progress value={percent} className="h-1.5" aria-label={`مصرف ${u.name}`} />
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {u.expiresAt ? (
                            <span className="flex flex-col">
                              <span className="text-sm tabular-nums">{formatDate(u.expiresAt)}</span>
                              {state === "active" && remainingDays !== null && remainingDays <= 7 && (
                                <span className="text-[11px] text-amber-600 dark:text-amber-400">
                                  {remainingDays.toLocaleString("fa-IR")} روز مانده
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">بدون انقضا</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => copySubLink(u)}
                              aria-label={`کپی لینک اشتراک کلاینت ${u.name}`}
                              title="کپی لینک اشتراک (برای کلاینت)"
                            >
                              <Copy className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => copyPageLink(u)}
                              aria-label={`کپی لینک صفحه اشتراک ${u.name}`}
                              title="کپی لینک صفحه اشتراک (برای مرورگر)"
                            >
                              <ExternalLink className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => copyUuid(u)}
                              aria-label={`کپی شناسه UUID ${u.name}`}
                              title={u.uuid ?? "UUID در دسترس نیست"}
                            >
                              <Fingerprint className="size-4" aria-hidden="true" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={u.active}
                            onCheckedChange={(v) => toggleMutation.mutate({ id: u.id, active: v })}
                            disabled={toggleMutation.isPending}
                            aria-label={`فعال‌سازی ${u.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => openEdit(u)}
                              aria-label={`ویرایش ${u.name}`}
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleting(u)}
                              aria-label={`حذف ${u.name}`}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* گفت‌وگوی ساخت/ویرایش کاربر */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "ویرایش کاربر" : "کاربر جدید"}</DialogTitle>
            <DialogDescription>
              {form.id ? "مشخصات کاربر را ویرایش کنید." : "یک مشترک جدید با سهمیه و انقضای دلخواه بسازید."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="u-name">نام کاربر</Label>
              <Input
                id="u-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثلاً ali"
                dir="ltr"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-note">یادداشت (اختیاری)</Label>
              <Input
                id="u-note"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="توضیح کوتاه"
              />
            </div>
            <div className="rounded-xl border p-3.5 space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="u-unlimited" className="flex items-center gap-2 cursor-pointer">
                  <CircleCheck className="size-4 text-primary" aria-hidden="true" />
                  حجم نامحدود
                </Label>
                <Switch
                  id="u-unlimited"
                  checked={form.unlimited}
                  onCheckedChange={(v) => setForm({ ...form, unlimited: v })}
                />
              </div>
              {!form.unlimited && (
                <div className="space-y-2">
                  <Label htmlFor="u-quota">سهمیه حجم (گیگابایت)</Label>
                  <Input
                    id="u-quota"
                    type="number"
                    min="0"
                    step="0.1"
                    dir="ltr"
                    value={form.quotaGb}
                    onChange={(e) => setForm({ ...form, quotaGb: e.target.value })}
                    placeholder="مثلاً 50"
                  />
                </div>
              )}
            </div>
            <div className="rounded-xl border p-3.5 space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="u-exp" className="flex items-center gap-2 cursor-pointer">
                  <CalendarClock className="size-4 text-primary" aria-hidden="true" />
                  تاریخ انقضا
                </Label>
                <Switch
                  id="u-exp"
                  checked={form.hasExpiry}
                  onCheckedChange={(v) => setForm({ ...form, hasExpiry: v })}
                />
              </div>
              {form.hasExpiry && (
                <div className="space-y-2">
                  <Label htmlFor="u-exp-date">تاریخ (میلادی)</Label>
                  <Input
                    id="u-exp-date"
                    type="date"
                    dir="ltr"
                    value={form.expiryDate}
                    onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                    required={form.hasExpiry}
                  />
                </div>
              )}
            </div>
            {form.id && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => updateMutation.mutate({ id: form.id!, payload: { resetUsed: true } })}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                صفر کردن مصرف این کاربر
              </Button>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                انصراف
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {form.id ? "ذخیره تغییرات" : "ساخت کاربر"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* تایید حذف */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف کاربر «{deleting?.name}»؟</AlertDialogTitle>
            <AlertDialogDescription>
              این کاربر و لینک اشتراکش برای همیشه حذف می‌شود و قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              حذف کاربر
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {users.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <ExternalLink className="size-3" aria-hidden="true" />
          لینک اشتراک کلاینت: <code dir="ltr">/api/sub?token=…</code> · صفحه اشتراک در مرورگر: <code dir="ltr">/?sub=…</code> · دکمه اثر انگشت: کپی UUID
        </p>
      )}
    </motion.div>
  );
}
