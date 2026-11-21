import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuth } from "@/lib/auth";

export async function GET() {
  const [adminExists, auth] = await Promise.all([
    db.admin.count(),
    getAuth(),
  ]);
  if (auth) {
    const admin = await db.admin.findUnique({ where: { id: auth.id } });
    if (!admin) {
      return NextResponse.json({ authenticated: false, setupRequired: adminExists === 0 });
    }
    return NextResponse.json({ authenticated: true, username: admin.username, setupRequired: false });
  }
  return NextResponse.json({ authenticated: false, setupRequired: adminExists === 0 });
}
