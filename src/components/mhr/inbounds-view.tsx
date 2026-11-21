"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Copy, Globe, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/client-api";
import type { Inbound } from "@/lib/types";

type Protocol = "vless" | "vmess" | "trojan";

type FormState = {
  id: string | null;
  name: string;
  protocol: Protocol;
  port: string;
  tlsEnabled: boolean;
  sni: string;
  fragmentEnabled: boolean;
  fragmentSize: string;
  fragmentInterval: string;
  echEnabled: boolean;
  enabled: boolean;
};

function emptyForm(): FormState {
  return {
    id: null,
    name: "",
    protocol: "vless",
    port: "",
    tlsEnabled: true,
    sni: "",
    fragmentEnabled: false,
    fragmentSize: "",
    fragmentInterval: "",
    echEnabled: false,
    enabled: true,
  };
}

function toForm(i: Inbound): FormState {
  return {
    id: i.id,
    name: i.name,
    protocol: i.protocol,
    port: String(i.port),
    tlsEnabled: i.tlsEnabled,
    sni: i.sni ?? "",
    fragmentEnabled: i.fragmentEnabled,
    fragmentSize: i.fragmentSize ?? "",
    fragmentInterval: i.fragmentInterval ?? "",
    echEnabled: i.echEnabled,
    enabled: i.enabled,
  };
}

const PROTOCOL_LABELS: Record<Protocol, string> = {
  vless: "VLESS",
  vmess: "VMess",
  trojan: "Trojan",
};

export function InboundsView() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleting, setDeleting] = useState<Inbound | null>(null);

  const inboundsQuery = useQuery({
    queryKey: ["inbounds"],
    queryFn: () => api.get<{ inbounds: Inbound[] }>("/api/inbounds"),
    refetchInterval: 15000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["inbounds"] });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post("/api/inbounds", payload),
    onSuccess: () => {
      toast.success("اینباند ساخته شد");
      invalidate();
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.patch(`/api/inbounds/${id}`, payload),
    onSuccess: () => {
      toast.success("اینباند به‌روزرسانی شد");
      invalidate();
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch(`/api/inbounds/${id}`, { enabled }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/inbounds/${id}`),
    onSuccess: () => {
      toast.success("اینباند حذف شد");
      invalidate();
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    const port = Number(form.port);
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast.error("نام اینباند حداقل ۲ کاراکتر است");
      return;
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      toast.error("پورت باید عددی بین ۱ تا ۶۵۵۳۵ باشد");
      return;
    }
    if (form.fragmentEnabled && !form.fragmentSize.trim()) {
      toast.error("برای فعال‌سازی Fragment، اندازه پکت را وارد کنید (مثلاً 10-20)");
      return;
    }
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      protocol: form.protocol,
      port,
      tlsEnabled: form.tlsEnabled,
      sni: form.sni.trim() || null,
      fragmentEnabled: form.fragmentEnabled,
      fragmentSize: form.fragmentSize.trim() || null,
      fragmentInterval: form.fragmentInterval.trim() || null,
      echEnabled: form.echEnabled,
      enabled: form.enabled,
    };
    if (form.id) updateMutation.mutate({ id: form.id, payload });
    else createMutation.mutate(payload);
  }

  function copyConfig(i: Inbound) {
    const config = {
      remark: `mhr-${i.name}`,
      protocol: i.protocol,
      port: i.port,
      transport: "tcp",
      tls: i.tlsEnabled,
      ...(i.sni ? { sni: i.sni } : {}),
      ech: i.echEnabled,
      fragment: i.fragmentEnabled
        ? { size: i.fragmentSize ?? "", interval: i.fragmentInterval ?? "" }
        : undefined,
    };
    navigator.clipboard
      .writeText(JSON.stringify(config, null, 2))
      .then(() => toast.success("تنظیمات اینباند کپی شد"))
      .catch(() => toast.error("کپی ناموفق بود"));
  }

  const inbounds = inboundsQuery.data?.inbounds ?? [];
  const busy = createMutation.isPending || updateMutation.isPending;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {inbounds.length
            ? `${inbounds.length.toLocaleString("fa-IR")} اینباند تعریف شده`
            : "مدیریت ورودی‌های ترافیک پروکسی (VLESS / VMess / Trojan)"}
        </p>
        <Button
          onClick={() => {
            setForm(emptyForm());
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          اینباند جدید
        </Button>
      </div>

      {inboundsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : inbounds.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center px-6">
            <span className="rounded-2xl bg-accent p-3">
              <Globe className="size-7 text-accent-foreground" aria-hidden="true" />
            </span>
            <p className="font-medium">هیچ اینباندی تعریف نشده</p>
            <p className="text-sm text-muted-foreground max-w-sm leading-6">
              اینباند، نقطه ورود ترافیک پروکسی است. اولین اینباند را با پروتکل و پورت دلخواه بسازید و
              تنظیمات TLS، Fragment و ECH را روی آن فعال کنید.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {inbounds.map((i) => (
            <Card key={i.id} className="card-hover">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-accent p-1.5">
                        <Globe className="size-4 text-accent-foreground" aria-hidden="true" />
                      </span>
                      <span className="font-semibold">{i.name}</span>
                      <Badge variant="secondary" dir="ltr">
                        {PROTOCOL_LABELS[i.protocol] ?? i.protocol}
                      </Badge>
                      <Badge variant="secondary" className="tabular-nums" dir="ltr">
                        :{i.port}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {i.tlsEnabled ? (
                        <Badge variant="outline" className="border-sky-500/40 text-sky-600 dark:text-sky-400">
                          TLS
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          بدون TLS
                        </Badge>
                      )}
                      {i.echEnabled && (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                          ECH
                        </Badge>
                      )}
                      {i.fragmentEnabled && (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                          Fragment {i.fragmentSize && <span dir="ltr">{i.fragmentSize}</span>}
                        </Badge>
                      )}
                      {i.sni && (
                        <Badge variant="outline" className="text-muted-foreground" dir="ltr">
                          {i.sni}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={i.enabled}
                    onCheckedChange={(v) => toggleMutation.mutate({ id: i.id, enabled: v })}
                    disabled={toggleMutation.isPending}
                    aria-label={`فعال‌سازی اینباند ${i.name}`}
                  />
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className={`text-xs ${i.enabled ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                    {i.enabled ? "در حال سرویس‌دهی" : "غیرفعال"}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => copyConfig(i)}
                      aria-label={`کپی کانفیگ ${i.name}`}
                      title="کپی کانفیگ JSON"
                    >
                      <Copy className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => {
                        setForm(toForm(i));
                        setDialogOpen(true);
                      }}
                      aria-label={`ویرایش ${i.name}`}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleting(i)}
                      aria-label={`حذف ${i.name}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* گفت‌وگوی ساخت/ویرایش اینباند */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "ویرایش اینباند" : "اینباند جدید"}</DialogTitle>
            <DialogDescription>
              نقطه ورود ترافیک پروکسی را تعریف کنید؛ TLS، Fragment و ECH به‌صورت اختیاری فعال می‌شوند.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="i-name">نام اینباند</Label>
                <Input
                  id="i-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثلاً main-http"
                  dir="ltr"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i-port">پورت</Label>
                <Input
                  id="i-port"
                  type="number"
                  min="1"
                  max="65535"
                  dir="ltr"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: e.target.value })}
                  placeholder="443"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="i-proto">پروتکل</Label>
              <Select
                value={form.protocol}
                onValueChange={(v) => setForm({ ...form, protocol: v as Protocol })}
              >
                <SelectTrigger id="i-proto" dir="ltr" className="w-full">
                  <SelectValue placeholder="انتخاب پروتکل" />
                </SelectTrigger>
                <SelectContent dir="ltr">
                  <SelectItem value="vless">VLESS</SelectItem>
                  <SelectItem value="vmess">VMess</SelectItem>
                  <SelectItem value="trojan">Trojan</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                هر کاربر با شناسه یکتا روی همه اینباندها سرو می‌گیرد؛ VLESS روی TLS از فلو Vision استفاده می‌کند.
              </p>
            </div>
            <div className="rounded-xl border p-3.5 space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="i-tls">TLS</Label>
                <Switch
                  id="i-tls"
                  checked={form.tlsEnabled}
                  onCheckedChange={(v) => setForm({ ...form, tlsEnabled: v })}
                />
              </div>
              {form.tlsEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="i-sni">دامنه / SNI</Label>
                  <Input
                    id="i-sni"
                    dir="ltr"
                    value={form.sni}
                    onChange={(e) => setForm({ ...form, sni: e.target.value })}
                    placeholder="example.com"
                  />
                </div>
              )}
            </div>
            <div className="rounded-xl border p-3.5 space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="i-frag">Fragment (خردکردن پکت)</Label>
                <Switch
                  id="i-frag"
                  checked={form.fragmentEnabled}
                  onCheckedChange={(v) => setForm({ ...form, fragmentEnabled: v })}
                />
              </div>
              {form.fragmentEnabled && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="i-frag-size">اندازه پکت</Label>
                    <Input
                      id="i-frag-size"
                      dir="ltr"
                      value={form.fragmentSize}
                      onChange={(e) => setForm({ ...form, fragmentSize: e.target.value })}
                      placeholder="10-20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="i-frag-int">فاصله ارسال</Label>
                    <Input
                      id="i-frag-int"
                      dir="ltr"
                      value={form.fragmentInterval}
                      onChange={(e) => setForm({ ...form, fragmentInterval: e.target.value })}
                      placeholder="10-20"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-xl border p-3.5 space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="i-ech">ECH (رمزگذاری Hello)</Label>
                <Switch
                  id="i-ech"
                  checked={form.echEnabled}
                  onCheckedChange={(v) => setForm({ ...form, echEnabled: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="i-en">فعال بودن اینباند</Label>
                <Switch
                  id="i-en"
                  checked={form.enabled}
                  onCheckedChange={(v) => setForm({ ...form, enabled: v })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                انصراف
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {form.id ? "ذخیره تغییرات" : "ساخت اینباند"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* تایید حذف */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف اینباند «{deleting?.name}»؟</AlertDialogTitle>
            <AlertDialogDescription>
              اینباند روی پورت {deleting?.port.toLocaleString("fa-IR")} حذف می‌شود و کاربران دیگر از
              طریق آن سرویس نخواهند داشت.
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
              حذف اینباند
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
