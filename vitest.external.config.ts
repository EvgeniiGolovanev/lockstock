import { defineConfig } from "vitest/config";
import config from "./vitest.config";

export default defineConfig({
  ...config,
  test: { ...config.test, environment: "node", include: ["tests/external/email-delivery.acceptance.ts"], testTimeout: 60_000 }
});
