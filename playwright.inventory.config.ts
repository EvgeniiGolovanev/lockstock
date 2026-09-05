import { defineConfig, devices } from "@playwright/test";

const appRoot = process.env.INVENTORY_APP_ROOT;
const port = process.env.INVENTORY_APP_PORT;
if (!appRoot || !port) throw new Error("Use npm run test:inventory; this suite requires an isolated database and application.");

export default defineConfig({
  testDir: "./tests/inventory",
  outputDir: "./test-results/inventory",
  workers: 1,
  retries: 0,
  maxFailures: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { outputFolder: "test-results/inventory-report", open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    actionTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: `node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port ${port}`,
    cwd: appRoot,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.INVENTORY_SUPABASE_URL!,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.INVENTORY_ANON_KEY!,
      SUPABASE_SERVICE_ROLE_KEY: process.env.INVENTORY_SERVICE_ROLE_KEY!,
      NEXT_TELEMETRY_DISABLED: "1"
    }
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
