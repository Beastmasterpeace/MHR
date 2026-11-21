// کلاینت minimal VLESS برای تست هنگام توسعه هسته MHR
// یک درخواست HTTP از طریق اینباند VLESS هسته به مقصد ارسال می‌کند.
// اجرا: bun scripts/vless-probe.ts [port] [uuid] [host:port of target]
import net from "node:net";

const inboundPort = Number(process.argv[2] || 18555);
const uuid = process.argv[3];
const [targetHost, targetPort] = (process.argv[4] || "127.0.0.1:3000").split(":");

if (!uuid) {
  console.error("usage: bun scripts/vless-probe.ts <inboundPort> <uuid> [targetHost:targetPort]");
  process.exit(1);
}

function uuidBytes(u: string): Buffer {
  const hex = u.replace(/-/g, "");
  return Buffer.from(hex, "hex");
}

const destPort = Number(targetPort);
const hostBuf = Buffer.from(targetHost, "utf8");

// VLESS request: ver(0) + uuid(16) + addonsLen(0) + cmd(1=tcp) + port(2 BE) + addrType(2=domain) + addrLen + addr + payload
const header = Buffer.concat([
  Buffer.from([0x00]),
  uuidBytes(uuid),
  Buffer.from([0x00]), // طول افزونه‌ها = صفر
  Buffer.from([0x01]),
  Buffer.from([(destPort >> 8) & 0xff, destPort & 0xff]),
  Buffer.from([0x02, hostBuf.length]),
  hostBuf,
]);

const payload = Buffer.from(
  `GET / HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\nConnection: close\r\nUser-Agent: mhr-probe\r\n\r\n`,
  "utf8"
);

const sock = net.connect(inboundPort, "127.0.0.1");
let stage = 0;
let got = Buffer.alloc(0);
let totalDown = 0;

sock.on("connect", () => {
  sock.write(header);
  sock.write(payload);
});

sock.on("data", (d: Buffer) => {
  got = Buffer.concat([got, d]);
  totalDown += d.length;
  if (stage === 0 && got.length >= 2) {
    const addonLen = got[1];
    if (got.length >= 2 + addonLen) {
      stage = 1;
      const rest = got.subarray(2 + addonLen);
      if (rest.length) process.stdout.write(rest.toString("utf8").slice(0, 300));
    }
  } else if (stage === 1) {
    // باقی داده‌ها فقط شمرده می‌شوند
  }
});

sock.on("close", () => {
  console.log(`\nprobe done: received ${totalDown} bytes from core`);
});

sock.on("error", (e: Error) => {
  console.error("probe error:", e.message);
  process.exit(1);
});

setTimeout(() => sock.end(), 8000);
