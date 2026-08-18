import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const requireFromTest = createRequire(import.meta.url);
const {
  extractLocalMarkdownLinks,
  findUnexpectedFiles,
  formatBytes,
  summarizeAssets
} = requireFromTest("../../scripts/repository-hygiene-core.js") as {
  extractLocalMarkdownLinks: (markdown: string) => string[];
  findUnexpectedFiles: (expected: string[], actual: string[]) => string[];
  formatBytes: (bytes: number) => string;
  summarizeAssets: (entries: Array<{ path: string; bytes: number }>) => {
    fileCount: number;
    totalBytes: number;
    largest: Array<{ path: string; bytes: number }>;
  };
};

describe("repository hygiene helpers", () => {
  it("extracts only local Markdown link targets", () => {
    expect(
      extractLocalMarkdownLinks(
        "See [setup](docs/setup.md), [anchor](#local), [site](https://example.com), and <mailto:ops@example.com>."
      )
    ).toEqual(["docs/setup.md", "#local"]);
  });

  it("resolves reference-style local Markdown links", () => {
    expect(
      extractLocalMarkdownLinks("Read [the guide][guide].\n\n[guide]: docs/repository-assets.md#ownership")
    ).toEqual(["docs/repository-assets.md#ownership"]);
  });

  it("summarizes runtime assets deterministically", () => {
    expect(
      summarizeAssets([
        { path: "public/demo.mp4", bytes: 1_500 },
        { path: "public/logo.svg", bytes: 120 },
        { path: "public/preview.jpg", bytes: 720 }
      ])
    ).toEqual({
      fileCount: 3,
      totalBytes: 2_340,
      largest: [
        { path: "public/demo.mp4", bytes: 1_500 },
        { path: "public/preview.jpg", bytes: 720 },
        { path: "public/logo.svg", bytes: 120 }
      ]
    });
    expect(formatBytes(2_340)).toBe("2.29 KiB");
  });

  it("identifies generated files that are not in the canonical manifest", () => {
    expect(
      findUnexpectedFiles(["guide.svg", "nested/skill.md"], ["guide.svg", "extra.svg", "nested/skill.md"])
    ).toEqual(["extra.svg"]);
  });
});
