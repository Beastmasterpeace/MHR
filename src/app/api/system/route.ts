import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getSystemStats } from "@/lib/system";

export async function GET() {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const stats = await getSystemStats();
  return NextResponse.json(stats);
}
