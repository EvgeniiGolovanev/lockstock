import { describe, expect, it } from "vitest";
import { demoVideoHref } from "@/lib/ui/demo-video";

describe("demo video links", () => {
  it("uses the English demo for English pages", () => {
    expect(demoVideoHref("en")).toBe("/lockstock-demo.mp4");
  });

  it("uses the French demo for French pages", () => {
    expect(demoVideoHref("fr")).toBe("/lockstock-demo-fr.mp4");
  });
});
