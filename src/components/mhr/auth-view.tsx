"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, LogIn, ShieldCheck, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MhrWordmark } from "@/components/mhr/logo";
import { ThemeToggle } from "@/components/mhr/theme-toggle";
import { api } from "@/lib/client-api";

type Props = {
  mode: "login" | "setup";
  onSuccess: (username: string) => void;
};

export function AuthView({ mode, onSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const isSetup = mode === "setup";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (isSetup) {
      if (username.trim().length < 3) {
        toast.error("نام کاربری حداقل ۳ کاراکتر است");
        return;
      }
      if (password.length < 8) {
        toast.error("رمز عبور حداقل ۸ کاراکتر است");
        return;
      }
      if (password !== confirm) {
        toast.error("تکرار رمز عبور مطابقت ندارد");
        return;
      }
    }

    setBusy(true);
    try {
      const res = await api.post<{ username: string }>(
        isSetup ? "/api/auth/setup" : "/api/auth/login",
        { username: username.trim(), password }
      );
      toast.success(isSetup ? "پنل با موفقیت راه‌اندازی شد" : "خوش آمدید!");
      onSuccess(res.username);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطای نامشخص");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hero-glow min-h-screen flex flex-col">
      <header className="flex items-center justify-between p-4 sm:p-6">
        <MhrWordmark compact />
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <div className="rounded-2xl border bg-card/80 backdrop-blur p-6 sm:p-8 shadow-lg shadow-sky-500/5">
            <div className="flex flex-col items-center text-center gap-2 mb-8">
              <div className="brand-gradient rounded-2xl p-3 shadow-md shadow-sky-500/20">
                {isSetup ? (
                  <UserRoundPlus className="size-7 text-white" aria-hidden="true" />
                ) : (
                  <LogIn className="size-7 text-white" aria-hidden="true" />
                )}
              </div>
              <h1 className="text-xl font-bold mt-2">
                {isSetup ? "راه‌اندازی اولیه پنل" : "ورود به پنل MHR"}
              </h1>
              <p className="text-sm text-muted-foreground leading-6">
                {isSetup
                  ? "حساب مدیر پنل را بسازید؛ این اولین و آخرین بار است که این مرحله را می‌بینید."
                  : "برای مدیریت پنل وارد شوید."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">نام کاربری</Label>
                <Input
                  id="username"
                  dir="ltr"
                  autoComplete="username"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">رمز عبور</Label>
                <Input
                  id="password"
                  dir="ltr"
                  type="password"
                  autoComplete={isSetup ? "new-password" : "current-password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {isSetup && (
                <div className="space-y-2">
                  <Label htmlFor="confirm">تکرار رمز عبور</Label>
                  <Input
                    id="confirm"
                    dir="ltr"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
              )}
              <Button type="submit" disabled={busy} className="w-full h-11 text-[15px]">
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {isSetup ? "ساخت حساب مدیر" : "ورود"}
              </Button>
            </form>

            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mt-6">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              نشست‌ها رمزنگاری‌شده‌اند و ورود محدودسازی تلاش دارد
            </p>
          </div>
        </motion.div>
      </main>

      <footer className="mt-auto pb-5 text-center text-xs text-muted-foreground">
        MHR · پنل مدیریت شخصی
      </footer>
    </div>
  );
}
