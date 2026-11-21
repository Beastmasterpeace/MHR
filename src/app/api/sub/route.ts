import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPanelName, getSetting } from "@/lib/activity";
import { buildLinks } from "@/lib/core/links";
import type { SubInfo } from "@/lib/types";

// لینک اشتراک عمومی — فقط با توکن یکتای هر کاربر
// format=json  → اطلاعات کامل برای صفحه اشتراک پنل
// بدون پارامتر → خروجی base64 استاندارد برای کلاینت‌ها (v2rayNG و مانند آن)
// format=plain → لیست متنی لینک‌ها

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  const format = req.nextUrl.searchParams.get("format")?.trim() || "base64";

  if (!token) {
    return NextResponse.json({ error: "توکن اشتراک الزامی است" }, { status: 400 });
  }

  const user = await db.panelUser.findUnique({ where: { subToken: token } });
  if (!user) {
    return NextResponse.json({ error: "اشتراک یافت نشد" }, { status: 404 });
  }

  const inbounds = await db.inbound.findMany({
    where: { enabled: true },
    orderBy: { port: "asc" },
  });

  // دامنه لینک‌ها: اولویت با تنظیم دستی است؛ وگرنه از هدر درخواست (بدون پورت پنل)
  const customHost = (await getSetting("subHost"))?.trim();
  let host = "";
  if (customHost) {
    host = customHost;
  } else {
    const headerHost = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
      .split(",")[0]
      .trim();
    host = headerHost.replace(/:\d+$/, "");
  }

  const links = buildLinks(
    { name: user.name, uuid: user.uuid },
    inbounds,
    host
  );

  if (format === "base64" || format === "plain") {
    const body = links.map((l) => l.uri).join("\n");
    const out = format === "base64" ? Buffer.from(body, "utf8").toString("base64") : body;
    return new NextResponse(out, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Subscription-Userinfo": `upload=${Math.round(user.usedBytes)}; total=${
          user.unlimited ? "0" : Math.round(user.quotaBytes)
        }; expire=${user.expiresAt ? Math.round(user.expiresAt.getTime() / 1000) : "0"}`,
      },
    });
  }

  const info: SubInfo = {
    panelName: await getPanelName(),
    user: {
      name: user.name,
      note: user.note,
      quotaBytes: user.quotaBytes,
      unlimited: user.unlimited,
      usedBytes: user.usedBytes,
      expiresAt: user.expiresAt?.toISOString() ?? null,
      active: user.active,
    },
    inbounds: inbounds.map((i) => ({
      name: i.name,
      protocol: i.protocol,
      port: i.port,
      tlsEnabled: i.tlsEnabled,
      sni: i.sni,
      echEnabled: i.echEnabled,
      fragmentEnabled: i.fragmentEnabled,
    })),
    links,
    subHost: host,
  };
  return NextResponse.json(info);
}
