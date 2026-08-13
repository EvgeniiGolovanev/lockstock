import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("landing authentication copy", () => {
  it("renders the sign-up prompt with a real apostrophe", () => {
    const source = readFileSync(resolve(process.cwd(), "components/lockstock-landing.tsx"), "utf8");

    expect(source).toContain(`"Don't have an account? "`);
    expect(source).not.toContain(`"Don&apos;t have an account? "`);
  });
});
