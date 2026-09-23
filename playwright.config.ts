import { defineConfig, devices } from "@playwright/test";

const port = 4173;
const base = `http://127.0.0.1:${port}/aether/`;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: base,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node scripts/serve-export.mjs`,
    url: base,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        ...(process.env.CI ? {} : { channel: "chrome" as const }),
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        ...(process.env.CI ? {} : { channel: "chrome" as const }),
      },
    },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
  ],
});
