import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.TEST_APP_URL || "http://127.0.0.1:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname))
  throw Error(
    "Browser tests create records and require a disposable local environment.",
  );

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  // Authentication setup displays disposable secrets; do not record it.
  use: { baseURL, trace: "off", screenshot: "off", video: "off" },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
