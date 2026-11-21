# پنل MHR — تصویر داکر آماده برای Railway و هر هاست داکری
FROM oven/bun:1

WORKDIR /app

# پیش‌نیازهای Prisma روی دبیان
RUN apt-get update -qq \
  && apt-get install -y -qq --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# نصب وابستگی‌ها
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# کد پروژه
COPY . .

# دانلود باینری هسته ترافیک Xray (اگر از قبل موجود نباشد)
RUN bun run core:fetch

ENV NODE_ENV=production
# پیش‌فرض؛ روی Railway این را با متغیر سرویس بازنویسی کنید (مثلاً file:/data/mhr.db)
ENV DATABASE_URL=file:/data/mhr.db
ENV PORT=3000

# ساخت کلاینت Prisma و بیلد Next.js (خروجی standalone)
RUN bun run db:generate && bun run build

EXPOSE 3000

# در هر اجرا: ساخت پوشه دیتا، اعمال اسکیما روی دیتابیس تازه، اجرای سرور
CMD ["sh", "-c", "mkdir -p /data && bun run db:push && bun run start"]
