import { expect, test, type Page } from "@playwright/test";

function pathFor(route: string): string {
  return route === "/" ? "./" : `.${route}/`;
}

async function failedResponses(page: Page): Promise<string[]> {
  const problems: string[] = [];
  page.on("response", (response) => {
    const url = response.url();
    if (!url.startsWith("http://127.0.0.1")) return;
    if (response.status() >= 400) problems.push(`${response.status()} ${url}`);
  });
  return problems;
}

test("every coach session shows a heart-rate replay", async ({ page }) => {
  const problems = await failedResponses(page);
  await page.goto(pathFor("/coach"));
  const hrefs = await page.locator('a[href*="/coach/"]').evaluateAll((links) =>
    links
      .map((link) => link.getAttribute("href") ?? "")
      .filter((href) => /\/coach\/(?!live|build|custom)[^/?#]+\/?$/.test(href)),
  );
  const unique = [...new Set(hrefs)];
  expect(unique.length).toBeGreaterThan(0);
  for (const href of unique) {
    const path = new URL(href, page.url()).pathname;
    await page.goto(path);
    await expect(page.getByRole("img", { name: "Heart-rate replay" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play session" })).toBeVisible();
  }
  expect(problems).toEqual([]);
});

test("a workout detail shows an animated replay", async ({ page }) => {
  const problems = await failedResponses(page);
  await page.goto(pathFor("/workouts"));
  const replay = page.locator('a[href*="/workouts/view"]').first();
  await expect(replay).toBeVisible();
  await replay.click();
  await expect(page.getByRole("button", { name: /replay/ })).toBeVisible();
  await expect(page.getByText("Heart rate", { exact: true })).toBeVisible();
  expect(problems).toEqual([]);
});
