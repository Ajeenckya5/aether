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
  const before = fs.readFileSync(file, "utf8");
  const after = before
    .replace(/<link[^>]*rel="preload"[^>]*as="script"[^>]*>/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, (tag) => {
      if (tag.includes("__next_f") || /src="[^"]*\/_next\/static\//.test(tag)) return "";
      return tag;
    });
  if (!after.includes("Connect your band") || !after.includes("aether-greeting")) {
    throw new Error("Homepage strip removed the visible page.");
  }
  fs.writeFileSync(file, after);
  const scripts = [...after.matchAll(/<script\b([^>]*)>/g)].map((match) => match[1]);
  if (scripts.some((attrs) => attrs.includes("src="))) {
    throw new Error(`Homepage still loads a script: ${scripts.join(" | ")}`);
  }
}
