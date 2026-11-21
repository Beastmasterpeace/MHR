import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createToken, hashPassword, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[\w.-]+$/, "نام کاربری فقط حروف، عدد، نقطه و خط تیره"),
  password: z.string().min(8, "رمز عبور حداقل ۸ کاراکتر").max(128),
});

export async function POST(req: NextRequest) {
  const adminCount = await db.admin.count();
  if (adminCount > 0) {
    return NextResponse.json({ error: "راه‌اندازی اولیه قبلاً انجام شده است" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر" }, { status: 400 });
  }

  const admin = await db.admin.create({
    data: {
      username: parsed.data.username,
      passwordHash: hashPassword(parsed.data.password),
    },
  });

  await logActivity("auth", `راه‌اندازی اولیه پنل با نام کاربری «${admin.username}» انجام شد`);

  const token = await createToken(admin.id, admin.username);
  const res = NextResponse.json({ ok: true, username: admin.username });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
