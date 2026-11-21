"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Globe, Info, KeyRound, Loader2, Orbit, RotateCcw, ShieldOff, Type } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MhrLogo } from "@/components/mhr/logo";
import { api } from "@/lib/client-api";
import type { PanelSettings } from "@/lib/types";

export function SettingsView({ username }: { username: string }) {
  const [panelName, setPanelName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [subHost, setSubHost] = useState("");
  const [resetDay, setResetDay] = useState("1");
  const [coreAutoStart, setCoreAutoStart] = useState(true);
  const [busyCore, setBusyCore] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busyName, setBusyName] = useState(false);
  const [busyPass, setBusyPass] = useState(false);

  useEffect(() => {
    api
      .get<PanelSettings>("/api/settings")
      .then((r) => {
        setPanelName(r.panelName);
        setSavedName(r.panelName);
        setSubHost(r.subHost);
        setResetDay(String(r.resetDay));
        setCoreAutoStart(r.coreAutoStart);
      })
      .catch(() => toast.error("خواندن تنظیمات ناموفق بود"));
  }, []);

  async function savePanelName(e: React.FormEvent) {
    e.preventDefault();
    if (!panelName.trim()) {
      toast.error("نام پنل نمی‌تواند خالی باشد");
      return;
    }
    setBusyName(true);
    try {
      const r = await api.patch<{ panelName: string }>("/api/settings", { panelName: panelName.trim() });
      setSavedName(r.panelName);
      window.dispatchEvent(new CustomEvent("mhr:panel-name", { detail: r.panelName }));
      toast.success("نام پنل ذخیره شد");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطای نامشخص");
    } finally {
      setBusyName(false);
    }
  }

  async function saveCore(e: React.FormEvent) {
    e.preventDefault();
    const day = Number(resetDay);
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      toast.error("روز ریست باید عددی بین ۱ تا ۲۸ باشد");
      return;
    }
    setBusyCore(true);
    try {
      await api.patch<PanelSettings>("/api/settings", {
        subHost: subHost.trim(),
        resetDay: day,
        coreAutoStart,
      });
      toast.success("تنظیمات هسته و اشتراک ذخیره شد");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطای نامشخص");
    } finally {
      setBusyCore(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("رمز جدید حداقل ۸ کاراکتر است");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("تکرار رمز جدید مطابقت ندارد");
      return;
    }
    setBusyPass(true);
    try {
      await api.post("/api/settings/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("رمز عبور تغییر کرد");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطای نامشخص");
    } finally {
      setBusyPass(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4 lg:grid-cols-2">
      {/* نام پنل */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Type className="size-4 text-primary" aria-hidden="true" />
            نام پنل
          </CardTitle>
          <CardDescription>این نام در هدر، پانویس و صفحه اشتراک نمایش داده می‌شود.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePanelName} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="s-name">نام نمایشی</Label>
              <Input id="s-name" value={panelName} onChange={(e) => setPanelName(e.target.value)} dir="ltr" />
              {savedName && savedName !== panelName && (
                <p className="text-xs text-amber-600 dark:text-amber-400">ذخیره نشده — دکمه ذخیره را بزنید.</p>
              )}
            </div>
            <Button type="submit" disabled={busyName}>
              {busyName && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              ذخیره
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* هسته و اشتراک */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Orbit className="size-4 text-primary" aria-hidden="true" />
            هسته ترافیک و اشتراک
          </CardTitle>
          <CardDescription>دامنه لینک اشتراک و ریست ماهانه مصرف کاربران</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveCore} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="s-host">دامنه اشتراک (اختیاری)</Label>
              <Input
                id="s-host"
                dir="ltr"
                value={subHost}
                onChange={(e) => setSubHost(e.target.value)}
                placeholder="مثلاً sub.example.com یا 1.2.3.4:8443"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Globe className="size-3" aria-hidden="true" />
                اگر خالی باشد، دامنه‌ای که پنل با آن باز شده به‌صورت خودکار در لینک‌های کانفیگ استفاده می‌شود.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-2">
                <Label htmlFor="s-reset">روز ریست ماهانه</Label>
                <Input
                  id="s-reset"
                  type="number"
                  min="1"
                  max="28"
                  dir="ltr"
                  value={resetDay}
                  onChange={(e) => setResetDay(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border px-3.5 py-2.5">
                <Label htmlFor="s-autostart" className="text-sm cursor-pointer">
                  اجرای خودکار هسته
                </Label>
                <Switch
                  id="s-autostart"
                  checked={coreAutoStart}
                  onCheckedChange={setCoreAutoStart}
                />
              </div>
            </div>
            <Button type="submit" disabled={busyCore}>
              {busyCore && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              <RotateCcw className="size-4" aria-hidden="true" />
              ذخیره تنظیمات هسته
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* تغییر رمز */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="size-4 text-primary" aria-hidden="true" />
            رمز عبور مدیر
          </CardTitle>
          <CardDescription>حساب فعلی: <span dir="ltr" className="font-medium">{username}</span></CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="s-cur">رمز فعلی</Label>
              <Input
                id="s-cur"
                type="password"
                dir="ltr"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="s-new">رمز جدید</Label>
                <Input
                  id="s-new"
                  type="password"
                  dir="ltr"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-conf">تکرار رمز جدید</Label>
                <Input
                  id="s-conf"
                  type="password"
                  dir="ltr"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={busyPass}>
              {busyPass && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              تغییر رمز عبور
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* درباره پنل */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="size-4 text-primary" aria-hidden="true" />
            درباره MHR
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <MhrLogo size={56} />
          <div className="space-y-1.5 text-sm leading-6">
            <p className="font-semibold text-base">MHR · نسخه ۱.۰.۰</p>
            <p className="text-muted-foreground max-w-2xl">
              پنل مدیریت شخصی MHR یک پروژه مستقل و اورجینال است؛ هسته ترافیک Xray با مدیریت خودکار
              کانفیگ، کاربران و اینباندهای VLESS/VMess/Trojan، آمار زنده مصرف، لینک اشتراک استاندارد
              و صفحه اشتراک اختصاصی برای هر مشترک را فراهم می‌کند.
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldOff className="size-3.5" aria-hidden="true" />
              بدون هیچ وابستگی به پروژه‌های دیگر — کد، طراحی و برند اختصاصی خودتان.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
