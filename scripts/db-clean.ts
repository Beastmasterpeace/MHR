// پاک‌سازی داده‌های تست پنل MHR — اجرا: bun scripts/db-clean.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  await db.activityLog.deleteMany({});
  await db.panelUser.deleteMany({});
  await db.inbound.deleteMany({});
  await db.admin.deleteMany({});
  // تنظیمات sessionSecret بماند (امن است)؛ فقط panelName ریست شود
  await db.setting.deleteMany({ where: { key: "panelName" } });
  console.log("cleaned:", {
    admins: await db.admin.count(),
    users: await db.panelUser.count(),
    inbounds: await db.inbound.count(),
    logs: await db.activityLog.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
