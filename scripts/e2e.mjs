import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const result = spawnSync("pnpm", ["exec", "playwright", "test", ...process.argv.slice(2)], {
  stdio: "inherit",
});

rmSync("test-results", { recursive: true, force: true });
rmSync("playwright-report", { recursive: true, force: true });
rmSync(".lighthouseci", { recursive: true, force: true });
process.exit(result.status ?? 1);
