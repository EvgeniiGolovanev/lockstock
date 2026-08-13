import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("account billing loader", () => {
  it("does not abort billing processing when audit log loading fails", () => {
    const source = readFileSync(join(process.cwd(), "components", "lockstock-account.tsx"), "utf8");

    expect(source).not.toContain("throw new Error(body.error ?? \"Failed to load audit log.\");");
    expect(source.indexOf("if (billingResponse.ok)")).toBeLessThan(source.indexOf("if (auditResponse.ok)"));
  });
});
