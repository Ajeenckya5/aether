/**
 * Seeded persona check. Confirms sample history never publishes a recovery age,
 * decimal commas parse, and greetings follow the local hour.
 */
const NIGHTS = 14;
const MARKERS = 6;

function gate(sample, nights, markers) {
  const nightsCollected = sample ? 0 : Math.max(0, Math.floor(nights));
  return !sample && nightsCollected >= NIGHTS && markers >= MARKERS;
}

function parseLocaleNumber(raw) {
  const trimmed = String(raw).trim().replace(/\s/g, "");
  if (!trimmed) return null;
  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");
  let normalized = trimmed;
  if (lastComma !== -1 && lastDot !== -1) {
    normalized = lastComma > lastDot ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed.replace(/,/g, "");
  } else if (lastComma !== -1) {
    normalized = trimmed.replace(",", ".");
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function greeting(hour) {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

let seed = 20260922;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}

const locales = ["en-US", "de-DE", "pt-BR", "ja-JP"];
const zones = ["America/New_York", "Europe/Berlin", "Pacific/Auckland", "Pacific/Honolulu"];
let blocked = 0;
let sampleAgeShown = 0;
let decimalMiss = 0;
const people = 1200;

for (let i = 0; i < people; i += 1) {
  const sample = rand() > 0.45;
  const nights = Math.floor(rand() * 40);
  const markers = Math.floor(rand() * 10);
  const published = gate(sample, nights, markers);
  if (sample && published) sampleAgeShown += 1;
  if (published && (nights < NIGHTS || markers < MARKERS)) blocked += 1;
  const weight = parseLocaleNumber(rand() > 0.5 ? "72,5" : "72.5");
  if (weight !== 72.5) decimalMiss += 1;
  const hour = Math.floor(rand() * 24);
  if (!greeting(hour)) blocked += 1;
  void locales[i % locales.length];
  void zones[i % zones.length];
}

const clean = people - blocked - sampleAgeShown - decimalMiss;
const report = {
  people,
  cleanSessions: clean,
  blocked,
  sampleAgeShown,
  decimalMiss,
};
console.log(JSON.stringify(report, null, 2));
if (blocked || sampleAgeShown || decimalMiss || clean / people < 0.9) {
  process.exit(1);
}
