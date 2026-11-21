// اجرای خودکار هسته ترافیک هنگام بوت سرور پنل
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { bootstrapCore } = await import("@/lib/core/manager");
    await bootstrapCore();
  } catch {
    // اگر هسته بالا نیامد، پنل باید همچنان کار کند
  }
}
