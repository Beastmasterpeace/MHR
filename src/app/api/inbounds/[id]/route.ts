import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { syncCore } from "@/lib/core/manager";
import { API_PORT } from "@/lib/core/paths";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(64).optional(),
  protocol: z.enum(["vless", "vmess", "trojan"]).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  tlsEnabled: z.boolean().optional(),
  sni: z.string().trim().max(200).nullable().optional(),
  fragmentEnabled: z.boolean().optional(),
  fragmentSize: z.string().trim().max(40).nullable().optional(),
  fragmentInterval: z.string().trim().max(40).nullable().optional(),
  echEnabled: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر" }, { status: 400 });
  }

  const existing = await db.inbound.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "اینباند یافت نشد" }, { status: 404 });
  if (parsed.data.port === API_PORT) {
    return NextResponse.json({ error: "این پورت برای API داخلی هسته رزرو شده است" }, { status: 400 });
  }

  try {
    const inbound = await db.inbound.update({ where: { id }, data: parsed.data });
    await logActivity("inbound", `اینباند «${inbound.name}» ویرایش شد`, { id: inbound.id });
    syncCore("ویرایش اینباند");
    return NextResponse.json({ inbound });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "این پورت قبلاً استفاده شده است" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await db.inbound.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "اینباند یافت نشد" }, { status: 404 });

  await db.inbound.delete({ where: { id } });
  await logActivity("inbound", `اینباند «${existing.name}» حذف شد`, { id });
  syncCore("حذف اینباند");
  return NextResponse.json({ ok: true });
}
