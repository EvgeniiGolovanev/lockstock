import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./tests/setup.ts"],
    coverage: { exclude: ["**/node_modules/**", "**/.next/**", "**/.superpowers/**", "**/test-results/**", "**/coverage/**", "tests/**", "**/*.d.ts"] }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  }
});
