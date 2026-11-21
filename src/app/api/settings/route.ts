import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { getPanelName, getSetting, setSetting, logActivity } from "@/lib/activity";
import { syncCore } from "@/lib/core/manager";

const patchSchema = z.object({
  panelName: z.string().trim().min(1).max(32).optional(),
  subHost: z.string().trim().max(200).optional(),
  resetDay: z.number().int().min(1).max(28).optional(),
  coreAutoStart: z.boolean().optional(),
});

export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [panelName, subHost, resetDay, coreAutoStart] = await Promise.all([
    getPanelName(),
    getSetting("subHost"),
    getSetting("resetDay"),
    getSetting("coreAutoStart"),
  ]);
  return NextResponse.json({
    panelName,
    subHost: subHost ?? "",
    resetDay: resetDay ? Number(resetDay) : 1,
    coreAutoStart: coreAutoStart !== "false",
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر" }, { status: 400 });
  }
  const d = parsed.data;

  if (d.panelName !== undefined) {
    await setSetting("panelName", d.panelName);
    await logActivity("system", `نام پنل به «${d.panelName}» تغییر کرد`);
  }
  if (d.subHost !== undefined) {
    await setSetting("subHost", d.subHost.replace(/^https?:\/\//i, "").replace(/\/+$/, ""));
    await logActivity("system", `دامنه اشتراک به «${d.subHost}» تغییر کرد`);
  }
  if (d.resetDay !== undefined) {
    await setSetting("resetDay", String(d.resetDay));
    await logActivity("system", `روز ریست ماهانه ترافیک به ${d.resetDay} تنظیم شد`);
  }
  if (d.coreAutoStart !== undefined) {
    await setSetting("coreAutoStart", d.coreAutoStart ? "true" : "false");
    await logActivity("system", `اجرای خودکار هسته ${d.coreAutoStart ? "فعال" : "غیرفعال"} شد`);
    syncCore("تغییر تنظیم هسته");
  }

  const [panelName, subHost, resetDay, coreAutoStart] = await Promise.all([
    getPanelName(),
    getSetting("subHost"),
    getSetting("resetDay"),
    getSetting("coreAutoStart"),
  ]);
  return NextResponse.json({
    panelName,
    subHost: subHost ?? "",
    resetDay: resetDay ? Number(resetDay) : 1,
    coreAutoStart: coreAutoStart !== "false",
  });
}
