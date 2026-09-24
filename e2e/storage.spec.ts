import { expect, test } from "@playwright/test";
import { SHELL_BUDGET, SHELL_CACHE, STORAGE_BUDGET } from "../src/lib/storage-budget";

const ROUTES = ["/", "/lab", "/sleep", "/workouts", "/coach", "/strain", "/download", "/settings", "/privacy"];

function pathFor(route: string): string {
  return route === "/" ? "./" : `.${route}/`;
}

test("a full session stays under 5 MB of browser storage", async ({ page }) => {
  test.setTimeout(90_000);
  for (const route of ROUTES) {
    await page.goto(pathFor(route));
    await expect(page).toHaveTitle(/Aether/);
  }
  await page.goto(pathFor("/settings"));
  await page.getByLabel("Name").fill("Ada");
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  if (await page.locator("[data-settings-layout=desktop]").count()) {
    await page.getByRole("button", { name: "Data and privacy", exact: true }).click();
  }
  await expect(page.locator("#storageUsed")).toContainText(/Storage used: \d+\.\d MB/);
  await page.waitForFunction(async () => {
    const ready = await navigator.serviceWorker?.ready;
    return Boolean(ready?.active);
  });
  await page.goto(pathFor("/"));
  await page.reload();
  const bytes = await page.evaluate(async () => {
    const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : { usage: 0 };
    let local = 0;
    let owned = 0;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) || "";
      const size = (key.length + String(localStorage.getItem(key) || "").length) * 2;
      local += size;
      if (key.startsWith("aether-")) owned += size;
    }
    const names = typeof caches === "undefined" ? [] : await caches.keys();
    const foreign = local !== owned || names.some((name) => !name.startsWith("aether-"));
    const usage = Number(estimate.usage) || 0;
    if (!foreign) return usage < local ? usage + local : usage;
    return owned;
  });
  expect(bytes).toBeLessThanOrEqual(STORAGE_BUDGET);
  const shell = await page.evaluate(async (name) => {
    if (typeof caches === "undefined") return 0;
    const cache = await caches.open(name);
    let total = 0;
    for (const request of await cache.keys()) {
      const response = await cache.match(request);
      if (response) total += (await response.clone().arrayBuffer()).byteLength;
    }
    return total;
  }, SHELL_CACHE);
  expect(shell).toBeLessThanOrEqual(SHELL_BUDGET);

  await page.goto(pathFor("/settings"));
  if (await page.locator("[data-settings-layout=desktop]").count()) {
    await page.getByRole("button", { name: "Danger zone", exact: true }).click();
  }
  await page.getByRole("button", { name: "Erase all data on this device" }).click();
  await expect(page.getByLabel("Type erase to confirm")).toBeVisible();
  if (await page.locator("[data-settings-layout=desktop]").count()) {
    await page.getByRole("button", { name: "Profile", exact: true }).click();
  }
  await expect(page.getByLabel("Name")).toHaveValue("Ada");
});
