import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const api = path.join(root, "src/app/api");
const backup = path.join(root, ".pages-api-backup");

function restoreApi() {
  if (!fs.existsSync(backup)) return;
  fs.mkdirSync(path.dirname(api), { recursive: true });
  if (fs.existsSync(api)) fs.rmSync(api, { recursive: true, force: true });
  fs.cpSync(backup, api, { recursive: true });
  fs.rmSync(backup, { recursive: true, force: true });
}

if (!fs.existsSync(api)) {
  console.error("src/app/api is missing; refusing to run a Pages build.");
  process.exit(1);
}

if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
fs.cpSync(api, backup, { recursive: true });
fs.rmSync(api, { recursive: true, force: true });
fs.rmSync(path.join(root, ".next"), { recursive: true, force: true });

let code = 0;
try {
  const result = spawnSync("npx", ["next", "build"], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      STATIC_EXPORT: "1",
      NEXT_PUBLIC_STATIC: "1",
      NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH ?? "/aether",
      NEXT_PUBLIC_SITE_URL:
        process.env.NEXT_PUBLIC_SITE_URL || "https://ajeenckya5.github.io/aether",
    },
  });
  code = result.status ?? 1;
  if (code === 0) {
    fs.writeFileSync(path.join(root, "out", ".nojekyll"), "");
    stripHomeRuntime(path.join(root, "out", "index.html"));
  }
} catch (error) {
  restoreApi();
  throw error;
}

restoreApi();
process.exit(code);

/** The app router always emits the React runtime. The homepage HTML is already complete. */
function stripHomeRuntime(file) {
  if (!fs.existsSync(file)) return;
  const html = fs.readFileSync(file, "utf8");
  const lower = html.toLowerCase();
  const pieces = [];
  let cursor = 0;
  while (cursor < html.length) {
    const scriptAt = lower.indexOf("<script", cursor);
    const linkAt = lower.indexOf("<link", cursor);
    const nextAt = earliest(scriptAt, linkAt);
    if (nextAt < 0) {
      pieces.push(html.slice(cursor));
      break;
    }
    pieces.push(html.slice(cursor, nextAt));
    const openEnd = html.indexOf(">", nextAt);
    if (openEnd < 0) throw new Error("Homepage HTML has an unclosed tag.");
    if (nextAt === linkAt) {
      const tag = html.slice(nextAt, openEnd + 1);
      if (!tag.toLowerCase().includes('as="script"')) pieces.push(tag);
      cursor = openEnd + 1;
      continue;
    }
    const close = lower.indexOf("</script>", openEnd);
    if (close < 0) throw new Error("Homepage HTML has an unclosed script.");
    const end = close + "</script>".length;
    const tag = html.slice(nextAt, end);
    const runtime = tag.includes("/_next/static/") || tag.includes("__next_f");
    if (!runtime) pieces.push(tag);
    cursor = end;
  }
  const after = pieces.join("");
  if (!after.includes("Connect your band") || !after.includes("aether-greeting")) {
    throw new Error("Homepage strip removed the visible page.");
  }
  if (/\/_next\/static\/chunks\/[^"' ]+\.js/.test(after) || !after.includes("serviceWorker.register")) {
    throw new Error("Homepage strip left the client runtime or dropped the service worker.");
  }
  fs.writeFileSync(file, after);
}

function earliest(left, right) {
  if (left < 0) return right;
  if (right < 0) return left;
  return Math.min(left, right);
}
