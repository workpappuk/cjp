import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PW_BASE_URL || "https://cjp-nine.vercel.app";
const shouldUseLocalServer =
  baseURL.includes("127.0.0.1") || baseURL.includes("localhost");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: shouldUseLocalServer
    ? {
        command: "npm run dev",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      }
    : undefined,
});
