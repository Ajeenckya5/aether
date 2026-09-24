import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const COUNT = Number(process.env.PERSONA_COUNT || 300);
if (!process.env.CI && COUNT >= 1200) {
  console.error("The 1,200-persona simulation runs in GitHub Actions.");
  process.exit(1);
}
const BASE = "http://127.0.0.1:4173/aether";
const LOCALES = ["en-US", "de-DE", "pt-BR", "ja-JP", "fr-FR", "es-MX"];
const ZONES = ["America/New_York", "Europe/Berlin", "America/Sao_Paulo", "Asia/Tokyo", "Pacific/Auckland", "Pacific/Honolulu"];
const WEARABLES = ["none", "Apple Watch", "WHOOP", "Garmin", "Oura", "Fitbit", "Polar", "Samsung"];
const ARCHETYPES = ["new", "returning", "traveler", "recovering", "builder"];
const ACCENTS = ["São Paulo", "Zürich", "München"];

let seed = 20260922;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}
function pick(list) {
  return list[Math.floor(rand() * list.length)];
}

const people = Array.from({ length: COUNT }, (_, index) => ({
  id: index + 1,
  locale: pick(LOCALES),
  zone: pick(ZONES),
  wearable: pick(WEARABLES),
  archetype: pick(ARCHETYPES),
  age: 17 + Math.floor(rand() * 59),
  allowGps: rand() > 0.2,
  sample: true,
  issues: [],
}));

function add(person, code, severity) {
  person.issues.push({ code, severity });
}

async function openLocation(page) {
  if (await page.locator("[data-settings-layout=desktop]").count()) {
    await page.getByRole("button", { name: "Weather", exact: true }).click();
    return;
  }
  await page.getByRole("button", { name: "Location", exact: true }).click();
}

const server = spawn("node", ["scripts/serve-export.mjs"], {
  stdio: "ignore",
  detached: false,
});

async function waitForSite() {
  const start = Date.now();
  while (Date.now() - start < 60_000) {
    try {
      const response = await fetch(`${BASE}/`);
      if (response.ok) return;
    } catch {
      // server still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error("Export did not start.");
}

function writeReport(stats) {
  const rows = people
    .filter((person) => person.issues.length > 0)
    .slice(0, 200)
    .map(
      (person) =>
        `<tr><td>${person.id}</td><td>${person.locale}</td><td>${person.zone}</td><td>${person.wearable}</td><td>${person.issues
          .map((issue) => `${issue.severity}:${issue.code}`)
          .join(", ")}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Aether persona report</title>
<style>body{font-family:sans-serif;background:#111;color:#eee;margin:2rem}td,th{border-bottom:1px solid #333;padding:.4rem;text-align:left}input{min-height:44px}</style>
</head><body>
<h1>Persona replay</h1>
<p>${stats.people} same-origin sessions. Clean ${(stats.cleanRate * 100).toFixed(1)}%. Blocked ${stats.blocked}. Sample age shown ${stats.sampleAgeShown}. GPS misses ${stats.gpsMiss} of ${stats.gpsChecked}. Media misses ${stats.mediaMiss}. JS errors ${stats.jsErrors}.</p>
<input id="q" aria-label="Filter issue code" placeholder="Filter issue code">
<table id="t"><thead><tr><th>Id</th><th>Locale</th><th>Zone</th><th>Wearable</th><th>Issues</th></tr></thead><tbody>${rows}</tbody></table>
<script>document.getElementById("q").addEventListener("input",(event)=>{const q=event.target.value.toLowerCase();for(const row of document.querySelectorAll("#t tbody tr")) row.hidden=q&&!row.textContent.toLowerCase().includes(q);});</script>
</body></html>`;
  const out = process.env.CI
    ? path.join(path.dirname(new URL(import.meta.url).pathname), "report.html")
    : path.join(os.tmpdir(), "aether-persona-replay.html");
  fs.writeFileSync(out, html);
  console.log(JSON.stringify(stats, null, 2));
  console.log(out);
}

let browser;
try {
  await waitForSite();
  browser = await chromium.launch(process.env.CI ? {} : { channel: "chrome" });
  const context = await browser.newContext();
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 43.07, longitude: -89.4 });
  const page = await context.newPage();
  const js = [];
  page.on("pageerror", (error) => js.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") js.push(message.text());
  });
  await context.route("**/api.open-meteo.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await context.route("**/air-quality-api.open-meteo.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await context.route("**/api.bigdatacloud.net/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        city: "Madison",
        principalSubdivision: "Wisconsin",
        countryName: "United States",
      }),
    }),
  );
  await context.route("**/geocoding-api.open-meteo.com/**", (route) => {
    const name = new URL(route.request().url()).searchParams.get("name") || "City";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [{ name, latitude: -23.55, longitude: -46.63, country: "Test", admin1: name }],
      }),
    });
  });

  const media = await page.request.get(`${BASE}/media/route.svg`);
  const mediaMiss = media.status() === 200 ? 0 : COUNT;

  let sampleAgeShown = 0;
  let jsErrors = 0;
  let gpsMiss = 0;
  let gpsChecked = 0;
  let decimalMiss = 0;
  let decimalChecked = false;

  for (const person of people) {
    const before = js.length;
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    const text = await page.locator("body").innerText();
    if (/high confidence/i.test(text)) {
      sampleAgeShown += 1;
      add(person, "sample-age", "critical");
    }
    if (js.length > before) {
      jsErrors += 1;
      add(person, "js-error", "critical");
    }
    if (mediaMiss) add(person, "media", "serious");

    if (person.allowGps && person.id % 25 === 0) {
      gpsChecked += 1;
      await page.goto(`${BASE}/settings/`, { waitUntil: "domcontentloaded" });
      try {
        await openLocation(page);
        await page.getByRole("button", { name: "Use my location" }).click();
        await page.getByText(/Madison/).waitFor({ state: "visible", timeout: 8000 });
      } catch {
        gpsMiss += 1;
        add(person, "gps-city", "serious");
      }
    }

    if (!decimalChecked && (person.locale === "de-DE" || person.locale === "pt-BR")) {
      decimalChecked = true;
      await page.goto(`${BASE}/settings/`, { waitUntil: "domcontentloaded" });
      const weight = page.getByLabel("Weight in kilograms");
      await weight.fill("72,5");
      await weight.blur();
      const value = await weight.inputValue();
      if (!/72[.,]5/.test(value)) {
        decimalMiss += 1;
        add(person, "decimal", "serious");
      }
    }
  }

  for (const city of ACCENTS) {
    const person = people[0];
    await page.goto(`${BASE}/settings/`, { waitUntil: "domcontentloaded" });
    await openLocation(page);
    await page.getByLabel("Search city").fill(city);
    const choice = page.getByRole("button", { name: city });
    try {
      await choice.waitFor({ state: "visible", timeout: 8000 });
      await choice.click();
      try {
        await page.getByText(city).first().waitFor({ state: "visible", timeout: 8000 });
      } catch {
        add(person, "city-search", "serious");
      }
    } catch {
      add(person, "city-search", "serious");
    }
  }

  const clean = people.filter((person) => person.issues.length === 0).length;
  const blocked = people.filter((person) =>
    person.issues.some((issue) => issue.code === "sample-age" || issue.code === "blocked"),
  ).length;
  const gpsRate = gpsChecked === 0 ? 1 : 1 - gpsMiss / gpsChecked;
  const stats = {
    people: COUNT,
    cleanSessions: clean,
    cleanRate: clean / COUNT,
    blocked,
    sampleAgeShown,
    decimalMiss,
    gpsMiss,
    gpsChecked,
    mediaMiss,
    jsErrors,
  };
  writeReport(stats);
  if (
    blocked ||
    sampleAgeShown ||
    decimalMiss ||
    mediaMiss ||
    jsErrors ||
    stats.cleanRate < 0.9 ||
    gpsRate < 0.98
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser?.close();
  server.kill();
}
