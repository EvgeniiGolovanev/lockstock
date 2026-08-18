import { describe, expect, it } from "vitest";
import { classifyPlanChange } from "@/lib/billing/transitions";

describe("subscription plan transitions", () => {
  it("applies tier upgrades immediately", () => {
    expect(classifyPlanChange("starter", "monthly", "operations", "monthly")).toEqual({
      mode: "immediate",
      immediate: { plan: "operations", interval: "monthly" },
      scheduled: null
    });
  });

  it("applies monthly-to-annual changes immediately", () => {
    expect(classifyPlanChange("operations", "monthly", "operations", "annual").mode).toBe("immediate");
  });

  it("schedules tier downgrades and annual-to-monthly changes", () => {
    expect(classifyPlanChange("business", "annual", "starter", "monthly").mode).toBe("scheduled");
    expect(classifyPlanChange("operations", "annual", "operations", "monthly").mode).toBe("scheduled");
  });

  it("splits a higher-tier annual-to-monthly request", () => {
    expect(classifyPlanChange("starter", "annual", "business", "monthly")).toEqual({
      mode: "split",
      immediate: { plan: "business", interval: "annual" },
      scheduled: { plan: "business", interval: "monthly" }
    });
  });
});
