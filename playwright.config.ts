import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm start",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run preview:v2",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "node scripts/serve.mjs dist-legacy/index.html",
      url: "http://127.0.0.1:4175",
      env: { PE_NOTE_PORT: "4175" },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
