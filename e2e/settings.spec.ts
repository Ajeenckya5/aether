import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("settings fits two phone screens and saves the name", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./settings/");
  await expect(page.getByRole("main").locator("[data-settings-layout=phone]")).toBeVisible();
  const name = page.getByLabel("Name");
  await expect(name).toBeVisible();
  const nameBox = await name.boundingBox();
  expect(nameBox).toBeTruthy();
  expect(nameBox!.y).toBeGreaterThanOrEqual(0);
  expect(nameBox!.y + nameBox!.height).toBeLessThanOrEqual(844);

  const height = await page.locator("main").evaluate((node) => node.scrollHeight);
  expect(height).toBeLessThanOrEqual(844 * 2);

  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/WHOOP/i);
  await expect(page.getByRole("button", { name: "Show advanced" })).toHaveAttribute("aria-expanded", "false");

  await name.fill("Ada");
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((item) => `${item.id}: ${item.help}`)).toEqual([]);
});
