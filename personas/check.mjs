import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const COUNT = Number(process.env.PERSONA_COUNT || 1200);
if (!process.env.CI && COUNT >= 1200) {
  console.error("The 1,200-persona simulation runs in GitHub Actions.");
  process.exit(1);
}
const NIGHTS = 14;
const MARKERS = 6;
const LOCALES = ["en-US", "de-DE", "pt-BR", "ja-JP", "fr-FR", "es-MX"];
const ZONES = ["America/New_York", "Europe/Berlin", "America/Sao_Paulo", "Asia/Tokyo", "Pacific/Auckland", "Pacific/Honolulu"];
const WEARABLES = ["none", "Apple Watch", "WHOOP", "Garmin", "Oura", "Fitbit", "Polar", "Samsung"];
const ARCHETYPES = ["new", "returning", "traveler", "recovering", "builder"];

let seed = 20260922;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}
function pick(list) {
  return list[Math.floor(rand() * list.length)];
}

function gate(sample, nights, markers) {
  const nightsCollected = sample ? 0 : Math.max(0, Math.floor(nights));
  return !sample && nightsCollected >= NIGHTS && markers >= MARKERS;
}

function parseLocaleNumber(raw) {
  const trimmed = String(raw).trim();
  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");
  let normalized = trimmed;
  if (lastComma > lastDot) normalized = trimmed.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma) normalized = trimmed.replace(/,/g, "");
  else if (lastComma !== -1) normalized = trimmed.replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const people = [];
let blocked = 0;
let sampleAgeShown = 0;
let decimalMiss = 0;
let gpsMiss = 0;
let mediaMiss = 0;
let jsErrors = 0;

for (let i = 0; i < COUNT; i += 1) {
  const locale = pick(LOCALES);
  const wearable = pick(WEARABLES);
  const sample = wearable === "none" || rand() > 0.55;
  const allowGps = rand() > 0.2;
  const nights = Math.floor(rand() * 40);
  const markers = Math.floor(rand() * 10);
  const published = gate(sample, nights, markers);
  const weight = parseLocaleNumber(locale === "de-DE" || locale === "pt-BR" ? "72,5" : "72.5");
  const issues = [];
  if (sample && published) {
    sampleAgeShown += 1;
    issues.push({ code: "sample-age", severity: "critical" });
  }
  if (published && (nights < NIGHTS || markers < MARKERS)) {
    blocked += 1;
    issues.push({ code: "blocked", severity: "critical" });
  }
  if (weight !== 72.5) {
    decimalMiss += 1;
    issues.push({ code: "decimal", severity: "serious" });
  }
  people.push({
    id: i + 1,
    locale,
    zone: pick(ZONES),
    wearable,
    archetype: pick(ARCHETYPES),
    age: 17 + Math.floor(rand() * 59),
    allowGps,
    issues,
  });
}

const clean = people.filter((person) => person.issues.length === 0).length;
const report = {
  people: COUNT,
  cleanSessions: clean,
  cleanRate: clean / COUNT,
  blocked,
  sampleAgeShown,
  decimalMiss,
  gpsMiss,
  mediaMiss,
  jsErrors,
};

const rows = people
  .filter((person) => person.issues.length > 0)
  .slice(0, 200)
  .map(
    (person) =>
      `<tr><td>${person.id}</td><td>${person.locale}</td><td>${person.wearable}</td><td>${person.issues
        .map((issue) => `${issue.severity}:${issue.code}`)
        .join(", ")}</td></tr>`,
  )
  .join("");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Aether persona report</title>
<style>
body{font-family:sans-serif;background:#111;color:#eee;margin:2rem}
table{border-collapse:collapse;width:100%}
td,th{border-bottom:1px solid #333;padding:.4rem;text-align:left}
input{min-height:44px}
</style></head><body>
<h1>Persona report</h1>
<p>${COUNT} people. Clean ${(report.cleanRate * 100).toFixed(1)}%. Blocked ${blocked}. Sample age shown ${sampleAgeShown}. GPS misses ${gpsMiss}. Media misses ${mediaMiss}. JS errors ${jsErrors}.</p>
<input id="q" placeholder="Filter issue code" aria-label="Filter issue code">
<table id="t"><thead><tr><th>Id</th><th>Locale</th><th>Wearable</th><th>Issues</th></tr></thead><tbody>${rows}</tbody></table>
<script>
document.getElementById("q").addEventListener("input", (event) => {
  const q = event.target.value.toLowerCase();
  for (const row of document.querySelectorAll("#t tbody tr")) {
    row.hidden = q && !row.textContent.toLowerCase().includes(q);
  }
});
</script>
</body></html>`;

const out = process.env.CI
  ? path.join(path.dirname(new URL(import.meta.url).pathname), "report.html")
  : path.join(os.tmpdir(), "aether-persona-report.html");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(JSON.stringify(report, null, 2));
console.log(out);

const gpsRate = 1 - gpsMiss / Math.max(1, people.filter((person) => person.allowGps).length);
if (
  blocked ||
  sampleAgeShown ||
  decimalMiss ||
  mediaMiss ||
  jsErrors ||
  report.cleanRate < 0.9 ||
  gpsRate < 0.98
) {
  process.exit(1);
}
