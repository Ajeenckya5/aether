import { expect, test, type Page } from "@playwright/test";

const ROUTES = [
  "/",
  "/lab",
  "/sleep",
  "/workouts",
  "/coach",
  "/strain",
  "/settings",
  "/privacy",
  "/atlas",
  "/coach/live",
  "/coach/sunrise-mobility",
  "/coach/ember-zone-two",
  "/coach/iron-circuit",
  "/coach/tide-breath",
  "/coach/hill-repeats",
  "/coach/recovery-walk",
  "/coach/floor-strength",
  "/coach/night-unwind",
];

function pathFor(route: string): string {
  return route === "/" ? "./" : `.${route}/`;
}

async function bodyText(page: Page): Promise<string> {
  return page.locator("body").innerText();
}

for (const route of ROUTES) {
  test(`${route} does not say WHOOP`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(pathFor(route), { waitUntil: "domcontentloaded" });
    expect(await bodyText(page), route).not.toMatch(/WHOOP/);
  });
}

test("a workout detail does not say WHOOP", async ({ page }) => {
  await page.goto(pathFor("/workouts"), { waitUntil: "domcontentloaded" });
  await page.locator('a[href*="/workouts/view"]').first().click();
  expect(await bodyText(page)).not.toMatch(/WHOOP/);
});

test("download lists the compatible straps", async ({ page }) => {
  await page.goto(pathFor("/download"), { waitUntil: "domcontentloaded" });
  const download = await bodyText(page);
  expect(download).toMatch(/WHOOP/);
  expect(download).toMatch(/Polar/);
});
