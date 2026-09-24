import { rmSync } from "node:fs";

const generated = ["test-results", "playwright-report", ".lighthouseci"];

export default function cleanGenerated() {
  for (const dir of generated) rmSync(dir, { recursive: true, force: true });
}
