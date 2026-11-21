import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "mhr_session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // یک هفته

// ---------- رمز عبور (scrypt) ----------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

// ---------- امضای توکن نشست (HMAC-SHA256) ----------

async function getSecret(): Promise<string> {
  const row = await db.setting.findUnique({ where: { key: "sessionSecret" } });
  if (row) return row.value;
  const secret = randomBytes(32).toString("hex");
  await db.setting.create({ data: { key: "sessionSecret", value: secret } });
  return secret;
}

type TokenPayload = { sub: string; username: string; iat: number; exp: number };

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

async function sign(data: string): Promise<string> {
  const secret = await getSecret();
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export async function createToken(adminId: string, username: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = { sub: adminId, username, iat: now, exp: now + SESSION_TTL_SEC };
  const body = b64url(JSON.stringify(payload));
  const sig = await sign(body);
  return `${body}.${sig}`;
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = await sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (!payload?.sub || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- نشست از روی کوکی ----------

export async function getAuth(): Promise<{ id: string; username: string } | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return { id: payload.sub, username: payload.username };
}

export const sessionCookieOptions = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SEC,
  secure: false, // در محیط پیش‌نمایش روی http سرو می‌شود
};

// ---------- محدودسازی تلاش ورود (in-memory) ----------

type Attempt = { count: number; resetAt: number };
const attempts = new Map<string, Attempt>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function loginRateLimit(key: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function loginRateLimitReset(key: string): void {
  attempts.delete(key);
}
