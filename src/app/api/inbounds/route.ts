import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { syncCore } from "@/lib/core/manager";
import { API_PORT } from "@/lib/core/paths";

const createSchema = z.object({
  name: z.string().trim().min(2, "نام اینباند حداقل ۲ کاراکتر").max(64),
  protocol: z.enum(["vless", "vmess", "trojan"]).optional(),
  port: z.number().int().min(1).max(65535),
  tlsEnabled: z.boolean().optional(),
  sni: z.string().trim().max(200).nullable().optional(),
  fragmentEnabled: z.boolean().optional(),
  fragmentSize: z.string().trim().max(40).nullable().optional(),
  fragmentInterval: z.string().trim().max(40).nullable().optional(),
  echEnabled: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const inbounds = await db.inbound.findMany({ orderBy: { port: "asc" } });
  return NextResponse.json({ inbounds });
}

export async function POST(req: NextRequest) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر" }, { status: 400 });
  }
  const d = parsed.data;
  if (d.fragmentEnabled && !d.fragmentSize) {
    return NextResponse.json({ error: "برای Fragment، اندازه پکت الزامی است" }, { status: 400 });
  }
  if (d.port === API_PORT) {
    return NextResponse.json({ error: "این پورت برای API داخلی هسته رزرو شده است" }, { status: 400 });
  }

  try {
    const inbound = await db.inbound.create({
      data: {
        name: d.name,
        protocol: d.protocol ?? "vless",
        port: d.port,
        tlsEnabled: d.tlsEnabled ?? true,
        sni: d.sni || null,
        fragmentEnabled: d.fragmentEnabled ?? false,
        fragmentSize: d.fragmentEnabled ? d.fragmentSize || null : null,
        fragmentInterval: d.fragmentEnabled ? d.fragmentInterval || null : null,
        echEnabled: d.echEnabled ?? false,
        enabled: d.enabled ?? true,
      },
    });
    await logActivity("inbound", `اینباند «${inbound.name}» روی پورت ${inbound.port} ساخته شد`, { id: inbound.id });
    syncCore("ساخت اینباند");
    return NextResponse.json({ inbound });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "این پورت قبلاً استفاده شده است" }, { status: 409 });
    }
    throw e;
  }
}
