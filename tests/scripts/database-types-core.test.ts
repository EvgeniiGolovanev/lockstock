import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const requireFromTest = createRequire(import.meta.url);
const { compareDatabaseTypes, normalizeDatabaseTypes } = requireFromTest(
  "../../scripts/database-types-core.js"
) as {
  compareDatabaseTypes: (currentText: string, generatedText: string) => {
    current: string;
    generated: string;
    matches: boolean;
  };
  normalizeDatabaseTypes: (text: string) => string;
};

describe("database types helpers", () => {
  it("normalizes line endings and final newline for generated output", () => {
    expect(normalizeDatabaseTypes("alpha\r\nbeta\r\n")).toBe("alpha\nbeta\n");
  });

  it("detects when the checked-in contract differs from the generated contract", () => {
    const comparison = compareDatabaseTypes("alpha\r\n", "alpha\nbeta\n");

    expect(comparison.matches).toBe(false);
    expect(comparison.current).toBe("alpha\n");
    expect(comparison.generated).toBe("alpha\nbeta\n");
  });
});
