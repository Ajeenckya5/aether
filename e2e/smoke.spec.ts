import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROUTES = ["/", "/lab", "/sleep", "/workouts", "/coach", "/strain", "/download", "/settings", "/privacy"];

function pathFor(route: string): string {
  return route === "/" ? "./" : `.${route}/`;
}

function greeting(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function hourIn(timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  return Number(parts.find((part) => part.type === "hour")?.value ?? "0");
}

async function guard(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("response", (response) => {
    const url = response.url();
    if (!url.startsWith("http://127.0.0.1")) return;
    if (response.status() >= 400) problems.push(`${response.status()} ${url}`);
  });
  return problems;
}

test.describe("static export", () => {
  for (const route of ROUTES) {
    test(`${route} has a title and no horizontal overflow`, async ({ page }) => {
      const problems = await guard(page);
      await page.goto(pathFor(route));
      await expect(page).toHaveTitle(/Aether/);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflow).toBe(false);
      expect(problems).toEqual([]);
    });

    for (const scheme of ["light", "dark"] as const) {
      test(`${route} has no serious axe violations in ${scheme} mode`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(pathFor(route));
        const results = await new AxeBuilder({ page }).analyze();
        const bad = results.violations.filter(
          (item) => item.impact === "serious" || item.impact === "critical",
        );
        expect(bad.map((item) => item.id)).toEqual([]);
      });
    }
  }

  test("hides recovery age on sample data", async ({ page }) => {
    await page.goto(pathFor("/"));
    await expect(page.getByText(/nights collected/i)).toBeVisible();
    await expect(page.getByText(/high confidence/i)).toHaveCount(0);
  });

  test("route drawing is served", async ({ request }) => {
    const response = await request.get("./media/route.svg");
    expect(response.status()).toBe(200);
  });

  for (const icon of [
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/icon-maskable-512.png",
    "icons/apple-touch-icon.png",
  ]) {
    test(`${icon} is a PNG`, async ({ request }) => {
      const response = await request.get(`./${icon}`);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"] ?? "").toContain("image/png");
    });
  }

  for (const zone of [
    "Pacific/Auckland",
    "Pacific/Honolulu",
    "America/New_York",
    "Europe/Berlin",
    "Asia/Tokyo",
    "UTC",
  ]) {
    test(`greeting matches ${zone}`, async ({ browser }) => {
      const context = await browser.newContext({
        timezoneId: zone,
        baseURL: "http://127.0.0.1:4173/aether/",
      });
      const page = await context.newPage();
      await page.goto(pathFor("/"));
      await expect(page.getByRole("heading", { level: 1 })).toContainText(greeting(hourIn(zone)));
      await context.close();
    });
  }

  test("accepts a decimal comma for weight", async ({ page }) => {
    await page.goto(pathFor("/settings"));
    const weight = page.getByLabel("Weight in kilograms");
    await weight.fill("72,5");
    await weight.blur();
    await expect(weight).toHaveValue(/72[.,]5/);
  });

  test("GPS shows a city", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 43.07, longitude: -89.4 });
    await page.route("**/api.bigdatacloud.net/**", (route) =>
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
    await page.goto(pathFor("/settings"));
    await page.getByRole("button", { name: /Use GPS/ }).click();
    await expect(page.getByText(/Madison/)).toBeVisible();
  });

  test("reloads from the cache while offline", async ({ page, browserName }) => {
    await page.goto(pathFor("/"));
    await page.waitForFunction(async () => {
      const ready = await navigator.serviceWorker.ready;
      return Boolean(ready.active);
    });
    await page.reload();
    await page.waitForFunction(async () => {
      const names = await caches.keys();
      for (const name of names) {
        const cache = await caches.open(name);
        if (await cache.match(location.href)) return true;
      }
      return false;
    });
    await page.context().setOffline(true);
    if (browserName === "webkit") {
      // Playwright's WebKit crashes on page.reload while a service worker is offline,
      // and fetch() rejects even when the document is already in the Cache API.
      const title = await page.evaluate(async () => {
        const names = await caches.keys();
        for (const name of names) {
          const cache = await caches.open(name);
          const response = await cache.match(location.href);
          if (!response) continue;
          const html = await response.text();
          const found = /<title>([^<]+)/.exec(html)?.[1] ?? "";
          if (found) return found;
        }
        return "";
      });
      expect(title).toMatch(/Aether|Offline/);
      return;
    }
    await page.reload();
    await expect(page).toHaveTitle(/Aether|Offline/);
  });

  test("exports and imports private JSON", async ({ page }) => {
    await page.goto(pathFor("/settings"));
    await page.getByLabel("Name").fill("Ada");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export JSON" }).click(),
    ]);
    const file = await download.path();
    expect(file).toBeTruthy();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('input[aria-label="Import Aether JSON"]').setInputFiles(file!);
    await expect(page.getByLabel("Name")).toHaveValue("Ada", { timeout: 15_000 });
  });

  test("settings fields are reachable from the keyboard", async ({ page }) => {
    await page.goto(pathFor("/settings"));
    let tag = "";
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press("Tab");
      tag = await page.evaluate(() => document.activeElement?.tagName ?? "");
      if (tag === "INPUT" || tag === "BUTTON" || tag === "A" || tag === "SELECT" || tag === "TEXTAREA") break;
    }
    expect(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]).toContain(tag);
  });
});
