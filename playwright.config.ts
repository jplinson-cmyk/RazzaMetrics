import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: {
    baseURL: "http://localhost:8788",
    headless: true,
    launchOptions: {
      executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    },
  },
  webServer: {
    command: "node scripts/dev-worker.mjs --e2e",
    url: "http://localhost:8788/api/config",
    timeout: 120000,
    reuseExistingServer: false,
  },
});
