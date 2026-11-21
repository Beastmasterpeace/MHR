import { db } from "@/lib/db";

// ثبت رویداد در لاگ فعالیت + پرکننده دوره‌ای لاگ (نگه‌داشتن ۵۰۰ رکورد آخر)

export async function logActivity(type: string, message: string, meta?: unknown): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        type,
        message,
        meta: meta === undefined ? null : JSON.stringify(meta),
      },
    });
    const count = await db.activityLog.count();
    if (count > 500) {
      const oldest = await db.activityLog.findMany({
        orderBy: { createdAt: "asc" },
        take: count - 500,
        select: { id: true },
      });
      if (oldest.length) {
        await db.activityLog.deleteMany({ where: { id: { in: oldest.map((r) => r.id) } } });
      }
    }
  } catch {
    // لاگ نباید جریان اصلی را بشکند
  }
}

// ---------- تنظیمات key/value ----------

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getPanelName(): Promise<string> {
  return (await getSetting("panelName")) || "MHR";
}
