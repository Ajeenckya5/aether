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
        test.setTimeout(90_000);
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
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
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
    if (await page.locator("[data-settings-layout=desktop]").count()) {
      await page.getByRole("button", { name: "Weather", exact: true }).click();
    } else {
      await page.getByRole("button", { name: /Location/ }).click();
    }
    await page.getByRole("button", { name: "Use my location" }).click();
    await expect(page.getByText(/Madison/)).toBeVisible();
  });

  test("reloads every main route from the cache while offline", async ({ page, browserName }) => {
    test.setTimeout(90_000);
    const routes = ["/", "/lab", "/sleep", "/workouts", "/coach", "/strain", "/download", "/settings", "/privacy", "/atlas"];
    for (const route of routes) {
      await page.goto(pathFor(route));
      await expect(page).toHaveTitle(/Aether/);
    }
    await page.evaluate(() => {
      localStorage.setItem(
        "aether-place-v1",
        JSON.stringify({
          lat: 43.07,
          lon: -89.4,
          name: "Madison, Wisconsin",
          timezone: "America/Chicago",
          source: "search",
        }),
      );
      localStorage.setItem(
        "aether-env-cache-v1",
        JSON.stringify({
          fetchedAt: "2026-09-23T12:00:00.000Z",
          lat: 43.07,
          lon: -89.4,
          timezone: "America/Chicago",
          elevationM: 200,
          weather: {
            tempC: 18,
            apparentC: 17,
            humidity: 50,
            windKph: 8,
            gustKph: null,
            precipMm: 0,
            cloudPct: 10,
            pressureHpa: 1015,
            weatherCode: 1,
            weatherText: "Clear",
            isDay: true,
          },
          derived: { heatIndexC: 18, humidexC: 18, wetBulbC: 12, wbgtC: 16, altitudePenaltyPct: 0 },
          air: {
            usAqi: 30,
            usAqiLabel: "Good",
            europeanAqi: null,
            pm25: 5,
            pm10: null,
            ozone: null,
            no2: null,
            pollenMax: null,
            pollenLabel: null,
          },
          sun: {
            sunrise: null,
            sunset: null,
            solarNoonHour: 12,
            uvMax: 4,
            uvLabel: "Moderate",
            dayTempMax: 20,
            dayTempMin: 10,
          },
          overnight: { minC: 12, meanC: 14 },
          outdoor: { level: "go", title: "Outside", notes: [] },
          bestWindow: null,
        }),
      );
    });
    await page.goto(pathFor("/lab"));
    await page.waitForFunction(async () => {
      const ready = await navigator.serviceWorker?.ready;
      return Boolean(ready?.active);
    });
    for (const route of routes) {
      await page.goto(pathFor(route));
      await expect(page).toHaveTitle(/Aether/);
    }
    await page.goto(pathFor("/lab"));
    await page.waitForFunction(async () => {
      const names = await caches.keys();
      for (const name of names) {
        const cache = await caches.open(name);
        const response = await cache.match(location.href);
        if (!response) continue;
        const html = await response.text();
        if (html.includes("aether-env-cache-v1")) return true;
      }
      return false;
    });
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false });
    });
    await page.context().setOffline(true);
    for (const route of routes) {
      if (browserName === "webkit") {
        const target = new URL(pathFor(route), "http://127.0.0.1:4173/aether/").href;
        const title = await page.evaluate(async (url) => {
          const names = await caches.keys();
          for (const name of names) {
            const cache = await caches.open(name);
            const keys = await cache.keys();
            for (const request of keys) {
              if (request.url !== url) continue;
              const response = await cache.match(request);
              if (!response) continue;
              const html = await response.text();
              const found = /<title>([^<]+)/.exec(html)?.[1] ?? "";
              if (found) return found;
            }
          }
          return "";
        }, target);
        expect(title).toMatch(/Aether|Offline/);
        continue;
      }
      await page.goto(pathFor(route));
      await expect(page).toHaveTitle(/Aether|Offline/);
    }
    if (browserName !== "webkit") {
      await page.goto(pathFor("/lab"));
      await expect(page.getByText("Saved weather from this phone.")).toBeVisible();
    }
  });

  test("exports and imports private JSON", async ({ page }) => {
    await page.goto(pathFor("/settings"));
    await page.getByLabel("Name").fill("Ada");
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    const desktop = page.locator("[data-settings-layout=desktop]");
    if (await desktop.count()) {
      await page.getByRole("button", { name: "Data and privacy", exact: true }).click();
    }
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export my data" }).click(),
    ]);
    const file = await download.path();
    expect(file).toBeTruthy();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    if (await desktop.count()) {
      await page.getByRole("button", { name: "Data and privacy", exact: true }).click();
    }
    await page.locator('input[aria-label="Restore from backup"]').setInputFiles(file!);
    if (await desktop.count()) {
      await page.getByRole("button", { name: "Profile", exact: true }).click();
    }
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
