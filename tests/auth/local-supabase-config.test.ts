import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("local Supabase auth config", () => {
  it("does not require email confirmation in local development", () => {
    const config = readFileSync(join(process.cwd(), "supabase", "config.toml"), "utf8");
    const emailAuthSection = config.match(/\[auth\.email\]([\s\S]*?)(?:\n\[|$)/)?.[1] ?? "";

    expect(emailAuthSection).toContain("enable_confirmations = false");
  });
});
