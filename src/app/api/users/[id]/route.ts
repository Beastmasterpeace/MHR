import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { syncCore } from "@/lib/core/manager";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(64).optional(),
  note: z.string().trim().max(200).nullable().optional(),
  quotaBytes: z.number().min(0).max(1e15).optional(),
  unlimited: z.boolean().optional(),
  usedBytes: z.number().min(0).max(1e15).optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  active: z.boolean().optional(),
  resetUsed: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر" }, { status: 400 });
  }
  const { resetUsed, expiresAt, ...rest } = parsed.data;

  const existing = await db.panelUser.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });

  try {
    const user = await db.panelUser.update({
      where: { id },
      data: {
        ...rest,
        ...(resetUsed ? { usedBytes: 0 } : {}),
        ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
        ...(rest.unlimited ? { quotaBytes: 0 } : {}),
      },
    });
    await logActivity("user", `کاربر «${user.name}» ویرایش شد`, { id: user.id });
    syncCore("ویرایش کاربر");
    return NextResponse.json({ user });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "کاربری با این نام قبلاً وجود دارد" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await db.panelUser.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });

  await db.panelUser.delete({ where: { id } });
  await logActivity("user", `کاربر «${existing.name}» حذف شد`, { id });
  syncCore("حذف کاربر");
  return NextResponse.json({ ok: true });
}
