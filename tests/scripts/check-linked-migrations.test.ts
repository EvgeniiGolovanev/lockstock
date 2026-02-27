import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const requireFromTest = createRequire(import.meta.url);
const {
  collectVersionTokens,
  parseRemoteMigrationVersionsFromJsonOutput,
  parseRemoteMigrationVersionsFromPrettyOutput
} = requireFromTest("../../scripts/check-linked-migrations.js") as {
  collectVersionTokens: (raw: unknown) => string[];
  parseRemoteMigrationVersionsFromJsonOutput: (output: string) => Set<string>;
  parseRemoteMigrationVersionsFromPrettyOutput: (output: string) => Set<string>;
};

describe("check-linked-migrations parser", () => {
  it("collects migration version tokens from text", () => {
    expect(collectVersionTokens("remote=202602231350 local=abc")).toEqual(["202602231350"]);
    expect(collectVersionTokens("none")).toEqual([]);
  });

  it("parses remote versions from JSON output", () => {
    const output = JSON.stringify([
      { local: "202602231350", remote: "202602231350" },
      { local: "202602232210", remote: "202602232210" },
      { local: "202602240110", remote: null }
    ]);

    const parsed = parseRemoteMigrationVersionsFromJsonOutput(output);
    expect(parsed.has("202602231350")).toBe(true);
    expect(parsed.has("202602232210")).toBe(true);
    expect(parsed.has("202602240110")).toBe(false);
  });

  it("parses remote versions from JSON output with only version keys", () => {
    const output = JSON.stringify({
      migrations: [
        { version: "202602231350", name: "init" },
        { version: "202602232210", name: "bootstrap" }
      ]
    });

    const parsed = parseRemoteMigrationVersionsFromJsonOutput(output);
    expect(parsed.has("202602231350")).toBe(true);
    expect(parsed.has("202602232210")).toBe(true);
  });

  it("parses remote versions from ASCII table output", () => {
    const output = `
Local           | Remote          | Time (UTC)
----------------|-----------------|---------------------
202602231350    | 202602231350    | 2026-02-23 13:50:00
202602232210    | 202602232210    | 2026-02-23 22:10:00
202602240110    |                 | 2026-02-24 01:10:00
`;

    const parsed = parseRemoteMigrationVersionsFromPrettyOutput(output);
    expect(parsed.has("202602231350")).toBe(true);
    expect(parsed.has("202602232210")).toBe(true);
    expect(parsed.has("202602240110")).toBe(false);
  });

  it("parses remote versions from Unicode table separators", () => {
    const sep = "\u2502";
    const output = `
Local           ${sep} Remote          ${sep} Time (UTC)
----------------${sep}-----------------${sep}---------------------
202602231350    ${sep} 202602231350    ${sep} 2026-02-23 13:50:00
`;
    const parsed = parseRemoteMigrationVersionsFromPrettyOutput(output);
    expect(parsed.has("202602231350")).toBe(true);
  });

  it("parses remote versions from spacing-based pretty output", () => {
    const output = `
Local          Remote         Time (UTC)
202602231350   202602231350   2026-02-23 13:50:00
202602232210   202602232210   2026-02-23 22:10:00
`;
    const parsed = parseRemoteMigrationVersionsFromPrettyOutput(output);
    expect(parsed.has("202602231350")).toBe(true);
    expect(parsed.has("202602232210")).toBe(true);
  });
});
