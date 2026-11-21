"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Globe,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Orbit,
  Settings,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MhrWordmark } from "@/components/mhr/logo";
import { ThemeToggle } from "@/components/mhr/theme-toggle";
import { DashboardView } from "@/components/mhr/dashboard";
import { CoreView } from "@/components/mhr/core-view";
import { UsersView } from "@/components/mhr/users-view";
import { InboundsView } from "@/components/mhr/inbounds-view";
import { ActivityView } from "@/components/mhr/activity-view";
import { SettingsView } from "@/components/mhr/settings-view";

export type ViewKey = "dashboard" | "users" | "inbounds" | "core" | "activity" | "settings";

const NAV: Array<{ key: ViewKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: "dashboard", label: "داشبورد", icon: LayoutDashboard },
  { key: "users", label: "کاربران", icon: Users },
  { key: "inbounds", label: "اینباندها", icon: Globe },
  { key: "core", label: "هسته ترافیک", icon: Orbit },
  { key: "activity", label: "لاگ فعالیت", icon: ListChecks },
  { key: "settings", label: "تنظیمات", icon: Settings },
];

type Props = {
  username: string;
  panelName: string;
  onLogout: () => void;
};

export function Shell({ username, panelName, onLogout }: Props) {
  const [view, setView] = useState<ViewKey>("dashboard");
  const current = NAV.find((n) => n.key === view)!;

  return (
    <div className="hero-glow min-h-screen flex flex-col">
      {/* نوار بالا */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 h-16">
          <div className="flex items-center gap-4">
            <MhrWordmark compact />
            <span className="hidden sm:block text-sm text-muted-foreground border-s ps-4">
              {current.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="rounded-full gap-2 px-3">
                  <span className="size-8 rounded-full brand-gradient text-white flex items-center justify-center text-sm font-bold">
                    {username.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden sm:inline text-sm">{username}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="flex flex-col">
                  <span>{username}</span>
                  <span className="text-xs font-normal text-muted-foreground">مدیر پنل</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onLogout}>
                  <LogOut className="size-4" aria-hidden="true" />
                  خروج از حساب
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1 w-full max-w-7xl mx-auto">
        {/* منوی کناری (دسکتاپ) — در RTL سمت راست */}
        <aside className="hidden md:flex flex-col gap-1 w-60 shrink-0 py-6 ps-6 pe-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const activeItem = view === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                aria-current={activeItem ? "page" : undefined}
                className={`relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeItem
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                {activeItem && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-y-1.5 start-0 w-1 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon className="size-4.5" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
          <div className="mt-auto px-4 pt-6">
            <div className="rounded-xl border border-dashed p-3.5 text-xs leading-5 text-muted-foreground">
              <Activity className="size-3.5 mb-1 text-primary" aria-hidden="true" />
              {panelName} روی همین سرور اجرا می‌شود و آمار داشبورد از خود میزبان خوانده می‌شود.
            </div>
          </div>
        </aside>

        {/* محتوا */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 pb-24 md:pb-6">
          <h1 className="md:hidden text-lg font-bold mb-4">{current.label}</h1>
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {view === "dashboard" && <DashboardView />}
              {view === "users" && <UsersView />}
              {view === "inbounds" && <InboundsView />}
              {view === "core" && <CoreView />}
              {view === "activity" && <ActivityView />}
              {view === "settings" && <SettingsView username={username} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* منوی پایین (موبایل) */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/90 backdrop-blur pb-[env(safe-area-inset-bottom)]"
        aria-label="ناوبری اصلی"
      >
        <div className="grid grid-cols-6 h-16">
          {NAV.map((item) => {
            const Icon = item.icon;
            const activeItem = view === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                aria-current={activeItem ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] transition-colors ${
                  activeItem ? "text-primary font-semibold" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* پانویس */}
      <footer className="hidden md:block mt-auto border-t py-4 text-center text-xs text-muted-foreground">
        {panelName} · پنل مدیریت شخصی · نسخه ۱.۰.۰
      </footer>
    </div>
  );
}
