import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:3000",
    ...devices["Desktop Chrome"],
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next start",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
