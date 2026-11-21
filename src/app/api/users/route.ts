import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { syncCore } from "@/lib/core/manager";

const createSchema = z.object({
  name: z.string().trim().min(2, "نام کاربر حداقل ۲ کاراکتر").max(64),
  note: z.string().trim().max(200).optional().nullable(),
  quotaBytes: z.number().min(0).max(1e15).optional(),
  unlimited: z.boolean().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional().or(z.literal("").transform(() => null)),
});

export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const users = await db.panelUser.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر" }, { status: 400 });
  }
  const d = parsed.data;

  try {
    const user = await db.panelUser.create({
      data: {
        name: d.name,
        note: d.note || null,
        uuid: randomUUID(),
        quotaBytes: d.unlimited ? 0 : d.quotaBytes ?? 0,
        unlimited: d.unlimited ?? false,
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
      },
    });
    await logActivity("user", `کاربر «${user.name}» ساخته شد`, { id: user.id });
    syncCore("ساخت کاربر");
    return NextResponse.json({ user });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "کاربری با این نام قبلاً وجود دارد" }, { status: 409 });
    }
    throw e;
  }
}
