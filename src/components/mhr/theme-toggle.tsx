"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

// بدون state اضافه: آیکون‌ها با کلاس دارک سوییچ می‌شوند تا هیچ اختلاف hydration رخ ندهد
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full"
      aria-label="تغییر تم روشن/تاریک"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="size-5 dark:hidden" aria-hidden="true" />
      <Moon className="size-5 hidden dark:block" aria-hidden="true" />
    </Button>
  );
}
