"use client";

import { cn } from "@/lib/utils";

// نشان برند MHR — لوگوی اختصاصی پنل
export function MhrLogo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="mhr-brand-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#mhr-brand-g)" />
      <path
        d="M18 44V20l14 14 14-14v24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MhrWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <MhrLogo size={compact ? 30 : 38} />
      <span className="leading-none">
        <span className={cn("block font-bold tracking-wide", compact ? "text-base" : "text-xl")}>MHR</span>
        {!compact && (
          <span className="block text-[11px] text-muted-foreground mt-1">پنل مدیریت شخصی</span>
        )}
      </span>
    </span>
  );
}
