import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuth, hashPassword, verifyPassword } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  currentPassword: z.string().min(1, "رمز فعلی الزامی است"),
  newPassword: z.string().min(8, "رمز جدید حداقل ۸ کاراکتر").max(128),
});

export async function POST(req: NextRequest) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر" }, { status: 400 });
  }

  const admin = await db.admin.findUnique({ where: { id: auth.id } });
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!verifyPassword(parsed.data.currentPassword, admin.passwordHash)) {
    return NextResponse.json({ error: "رمز عبور فعلی اشتباه است" }, { status: 400 });
  }

  await db.admin.update({
    where: { id: admin.id },
    data: { passwordHash: hashPassword(parsed.data.newPassword) },
  });
  await logActivity("auth", "رمز عبور مدیر تغییر کرد");
  return NextResponse.json({ ok: true });
}
