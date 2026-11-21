import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { getCoreSnapshot, restartCore, startCore, stopCore } from "@/lib/core/manager";

// وضعیت و کنترل هسته ترافیک (نیازمند ورود مدیر)

export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const snapshot = await getCoreSnapshot();
  return NextResponse.json(snapshot);
}

const actionSchema = z.object({
  action: z.enum(["start", "stop", "restart"]),
});

export async function POST(req: NextRequest) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "عملیات نامعتبر است" }, { status: 400 });
  }

  const { action } = parsed.data;
  let ok = true;
  let error: string | undefined;

  if (action === "start") {
    const r = await startCore();
    ok = r.ok;
    error = r.error;
    if (ok) await logActivity("core", "هسته ترافیک دستی اجرا شد");
  } else if (action === "stop") {
    await stopCore();
    await logActivity("core", "هسته ترافیک دستی متوقف شد");
  } else {
    const r = await restartCore();
    ok = r.ok;
    error = r.error;
    if (ok) await logActivity("core", "هسته ترافیک ری‌استارت شد");
  }

  return NextResponse.json({ ok, error: error ?? null });
}
