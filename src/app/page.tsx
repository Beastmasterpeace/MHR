"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthView } from "@/components/mhr/auth-view";
import { MhrLogo } from "@/components/mhr/logo";
import { Shell } from "@/components/mhr/shell";
import { SubView } from "@/components/mhr/sub-view";
import { api } from "@/lib/client-api";
import type { AuthMe } from "@/lib/types";

function LoadingScreen() {
  return (
    <div className="hero-glow min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="animate-pulse">
        <MhrLogo size={56} />
      </div>
      <p className="text-sm text-muted-foreground">در حال بارگذاری پنل…</p>
    </div>
  );
}

function Panel() {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<AuthMe>("/api/auth/me"),
    staleTime: 30_000,
  });

  const [panelName, setPanelName] = useState("MHR");
  const authenticated = !!me.data?.authenticated;
  const username = me.data?.username;

  useEffect(() => {
    if (!authenticated) return;
    api
      .get<{ panelName: string }>("/api/settings")
      .then((r) => setPanelName(r.panelName))
      .catch(() => undefined);
  }, [authenticated]);

  useEffect(() => {
    const handler = (e: Event) => {
      const name = (e as CustomEvent<string>).detail;
      if (name) setPanelName(name);
    };
    window.addEventListener("mhr:panel-name", handler);
    return () => window.removeEventListener("mhr:panel-name", handler);
  }, []);

  async function handleLogout() {
    await api.post("/api/auth/logout").catch(() => undefined);
    queryClient.setQueryData(["me"], { authenticated: false, setupRequired: false });
    queryClient.invalidateQueries({ queryKey: ["me"] });
  }

  if (me.isLoading) return <LoadingScreen />;

  if (me.data?.setupRequired) {
    return (
      <AuthView
        mode="setup"
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["me"] })}
      />
    );
  }

  if (!authenticated) {
    return (
      <AuthView
        mode="login"
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["me"] })}
      />
    );
  }

  return <Shell username={username!} panelName={panelName} onLogout={handleLogout} />;
}

function Router() {
  const searchParams = useSearchParams();
  const subToken = searchParams.get("sub");
  if (subToken) return <SubView token={subToken} />;
  return <Panel />;
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Router />
    </Suspense>
  );
}
