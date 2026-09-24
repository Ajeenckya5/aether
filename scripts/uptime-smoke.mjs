import { chromium } from "@playwright/test";

const origin = (process.env.UPTIME_ORIGIN || "https://ajeenckya5.github.io/aether").replace(/\/$/, "");
const routes = ["/", "/lab/", "/sleep/", "/strain/"];
const rawCoord = /\b-?\d{1,3}\.\d{2},\s*-?\d{1,3}\.\d{2}\b/;

const browser = await chromium.launch();
const page = await browser.newPage();
const problems = [];

page.on("pageerror", (error) => problems.push(`pageerror ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") problems.push(`console ${message.text()}`);
});
page.on("response", (response) => {
  const url = response.url();
  if (!url.startsWith(origin)) return;
  if (response.status() >= 400) problems.push(`${response.status()} ${url}`);
});

for (const route of routes) {
  const url = `${origin}${route}`;
  await page.goto(url, { waitUntil: "networkidle" });
  const text = await page.locator("body").innerText();
  if (rawCoord.test(text)) problems.push(`raw coordinates on ${route}`);
  if (/high confidence/i.test(text)) problems.push(`confidence label on ${route}`);
}

await browser.close();

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`uptime smoke ok ${routes.length} routes`);
