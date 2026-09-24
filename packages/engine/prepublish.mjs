import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const buildOnly = process.argv.includes("--build-only");

function run(args, cwd = here) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit", cwd });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!buildOnly) {
  run(
    [
      path.join(root, "node_modules/vitest/vitest.mjs"),
      "run",
      "--config",
      path.join(root, "vitest.config.ts"),
      path.join(here, "engine.test.ts"),
    ],
    root,
  );
}

run([path.join(root, "node_modules/typescript/bin/tsc"), "-p", path.join(here, "tsconfig.json")]);

const dist = path.join(here, "dist");
for (const name of fs.readdirSync(dist)) {
  if (!name.endsWith(".js") && !name.endsWith(".d.ts")) continue;
  const file = path.join(dist, name);
  const rewritten = fs
    .readFileSync(file, "utf8")
    .replaceAll(/from "(\.[^"]+)"/g, (_, spec) => `from "${spec}.js"`);
  fs.writeFileSync(file, rewritten);
}

run([
  "--input-type=module",
  "--eval",
  `import { decideCall, sleepPerformancePct } from "./dist/index.js";
   const sick = decideCall({ readiness: 90, acwr: 0.8, hrvZ: 1, tsb: 10, risk: 0.1, overreaching: false, illness: true });
   if (sick.call !== "recover") process.exit(1);
   if (sleepPerformancePct(7.5 * 3600000) !== 100) process.exit(1);`,
]);
