// دانلود خودکار باینری رسمی Xray-core برای هسته ترافیک پنل MHR
// اجرا: bun scripts/fetch-core.mjs  یا  node scripts/fetch-core.mjs
import { mkdirSync, existsSync, writeFileSync, chmodSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";

const CORE_DIR = process.env.MHR_CORE_DIR || join(process.cwd(), "core");
const BIN_DIR = join(CORE_DIR, "bin");

function targetAsset() {
  const p = process.platform;
  const a = process.arch;
  if (p === "linux" && a === "x64") return "Xray-linux-64.zip";
  if (p === "linux" && a === "arm64") return "Xray-linux-arm64-v8a.zip";
  if (p === "darwin" && a === "x64") return "Xray-macos-64.zip";
  if (p === "darwin" && a === "arm64") return "Xray-macos-arm64-v8a.zip";
  if (p === "win32" && a === "x64") return "Xray-windows-64.zip";
  throw new Error(`پلتفرم ${p}/${a} پشتیبانی نمی‌شود — باینری را دستی در ${BIN_DIR} بگذارید`);
}

const exeName = process.platform === "win32" ? "xray.exe" : "xray";
const binPath = join(BIN_DIR, exeName);

if (existsSync(binPath)) {
  console.log("core: binary already present at", binPath);
  process.exit(0);
}

const asset = targetAsset();
const url = `https://github.com/XTLS/Xray-core/releases/latest/download/${asset}`;
console.log("core: downloading", url);

const res = await fetch(url, { redirect: "follow" });
if (!res.ok) {
  console.error(`core: download failed (HTTP ${res.status})`);
  process.exit(1);
}

const zip = new Uint8Array(Buffer.from(await res.arrayBuffer()));
const files = unzipSync(zip);

mkdirSync(BIN_DIR, { recursive: true });
writeFileSync(binPath, Buffer.from(files[exeName]));
if (files["geoip.dat"]) writeFileSync(join(BIN_DIR, "geoip.dat"), Buffer.from(files["geoip.dat"]));
if (files["geosite.dat"]) writeFileSync(join(BIN_DIR, "geosite.dat"), Buffer.from(files["geosite.dat"]));
if (process.platform !== "win32") chmodSync(binPath, 0o755);

console.log("core: Xray binary saved to", binPath);
