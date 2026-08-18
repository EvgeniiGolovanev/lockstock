import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3010);
const baseURL = `http://127.0.0.1:${port}`;
const supabaseUrl = process.env.PLAYWRIGHT_SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabaseAnonKey = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY ?? "playwright-anon-key";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(port),
      PLAYWRIGHT_E2E: "true",
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey
    }
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
