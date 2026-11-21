import path from "node:path";

// مسیرهای اجرایی هسته ترافیک — همه‌چیز زیر پوشه core/
// با MHR_CORE_DIR قابل جابه‌جایی است (مثلاً روی Railway داخل volume)

export const CORE_DIR = process.env.MHR_CORE_DIR || path.join(process.cwd(), "core");
export const BIN_DIR = path.join(CORE_DIR, "bin");
export const RUNTIME_DIR = path.join(CORE_DIR, "runtime");
export const CERTS_DIR = path.join(RUNTIME_DIR, "certs");
export const CONFIG_PATH = path.join(RUNTIME_DIR, "config.json");

export const XRAY_BIN =
  process.env.MHR_XRAY_BIN || path.join(BIN_DIR, process.platform === "win32" ? "xray.exe" : "xray");

// پورت API داخلی هسته (فقط روی لوکال‌هاست) — برای خواندن آمار ترافیک
export const API_PORT = Number(process.env.MHR_CORE_API_PORT || 15490);
export const API_ADDR = `127.0.0.1:${API_PORT}`;
