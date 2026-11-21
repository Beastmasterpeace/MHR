import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createToken,
  loginRateLimit,
  loginRateLimitReset,
  sessionCookieOptions,
  SESSION_COOKIE,
  verifyPassword,
} from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

function clientKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(req: NextRequest) {
  const key = clientKey(req);
  const rl = loginRateLimit(key);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `تلاش‌های زیاد ناموفق؛ ${rl.retryAfterSec} ثانیه دیگر دوباره امتحان کنید` },
      { status: 429 }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "نام کاربری و رمز عبور الزامی است" }, { status: 400 });
  }

  const admin = await db.admin.findUnique({ where: { username: parsed.data.username } });
  if (!admin || !verifyPassword(parsed.data.password, admin.passwordHash)) {
    await logActivity("warn", `تلاش ناموفق ورود با نام کاربری «${parsed.data.username}»`);
    return NextResponse.json({ error: "نام کاربری یا رمز عبور اشتباه است" }, { status: 401 });
  }

  loginRateLimitReset(key);
  await logActivity("auth", `ورود موفق مدیر «${admin.username}»`);
  const token = await createToken(admin.id, admin.username);
  const res = NextResponse.json({ ok: true, username: admin.username });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
