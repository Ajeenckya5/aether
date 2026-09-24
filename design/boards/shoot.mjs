// Local only. Writes PNGs under /tmp/aether-directions, never into the repo.
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9333;
const out = process.env.AETHER_SHOTS || "/tmp/aether-directions";
const root = path.dirname(new URL(import.meta.url).pathname);
const boards = ["instrument", "editorial", "signal"];
const screens = ["today", "call", "live", "sleep", "lab", "settings", "empty", "error"];
const themes = ["light", "dark"];
const sizes = [
  { w: 390, h: 844, name: "390" },
  { w: 1440, h: 900, name: "1440" },
];

await mkdir(out, { recursive: true });
const proc = spawn(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--remote-debugging-port=${port}`,
    "--user-data-dir=/tmp/aether-chrome-shots",
    "about:blank",
  ],
  { stdio: "ignore" },
);

try {
  let version;
  for (let i = 0; i < 50; i += 1) {
    try {
      version = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (version.ok) break;
    } catch {
      version = null;
    }
    await delay(100);
  }
  if (!version?.ok) throw new Error("Chrome did not open a debugging port");

  const created = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
  const page = await created.json();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  let onLoad = null;
  function send(method, params = {}) {
    const msgId = ++id;
    return new Promise((resolve, reject) => {
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === "Page.loadEventFired" && onLoad) onLoad();
    if (!msg.id || !pending.has(msg.id)) return;
    const waiter = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) waiter.reject(new Error(JSON.stringify(msg.error)));
    else waiter.resolve(msg.result);
  });
  await new Promise((resolve) => ws.addEventListener("open", resolve));
  await send("Page.enable");

  for (const size of sizes) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: size.w,
      height: size.h,
      deviceScaleFactor: 1,
      mobile: size.w < 1000,
    });
    for (const board of boards) {
      for (const theme of themes) {
        for (const screen of screens) {
          const url = `file://${root}/${board}.html?screen=${screen}&theme=${theme}&shot=1`;
          onLoad = null;
          const loaded = new Promise((resolve) => {
            onLoad = resolve;
          });
          await send("Page.navigate", { url });
          await Promise.race([loaded, delay(1500)]);
          const shot = await send("Page.captureScreenshot", { format: "png" });
          const file = path.join(out, `${board}-${screen}-${theme}-${size.name}.png`);
          await writeFile(file, Buffer.from(shot.data, "base64"));
          process.stdout.write(`${board} ${screen} ${theme} ${size.name}\n`);
        }
      }
    }
  }
  ws.close();
  process.stdout.write(`96 shots in ${out}\n`);
} finally {
  proc.kill();
}
