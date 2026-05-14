import { describe, expect, it } from "vitest";
import { WORKFLOWS, workflowById, workflowImageForLocale, workflowsForPathname } from "@/lib/ui/workflows";

describe("workflow registry", () => {
  it("maps contextual pages to the expected workflow", () => {
    expect(workflowsForPathname("/stock-movements").map((workflow) => workflow.id)).toEqual(["stock-movement"]);
    expect(workflowsForPathname("/purchase-orders").map((workflow) => workflow.id)).toEqual(["purchase-orders"]);
    expect(workflowsForPathname("/members").map((workflow) => workflow.id)).toEqual(["members"]);
  });

  it("maps setup and inventory pages to the overview workflow", () => {
    expect(workflowsForPathname("/inventory").map((workflow) => workflow.id)).toEqual(["overview"]);
    expect(workflowsForPathname("/materials").map((workflow) => workflow.id)).toEqual(["overview"]);
    expect(workflowsForPathname("/locations").map((workflow) => workflow.id)).toEqual(["overview"]);
    expect(workflowsForPathname("/vendors").map((workflow) => workflow.id)).toEqual(["overview"]);
  });

  it("returns localized image paths", () => {
    const workflow = workflowById("purchase-orders");
    expect(workflow).toBeDefined();
    expect(workflowImageForLocale(workflow!, "en")).toBe("/workflows/purchase-order-lifecycle.svg");
    expect(workflowImageForLocale(workflow!, "fr")).toBe("/workflows/purchase-order-lifecycle-fr.svg");
  });

  it("keeps every workflow available in both languages", () => {
    for (const workflow of WORKFLOWS) {
      expect(workflow.image.en).toMatch(/^\/workflows\/.+\.svg$/);
      expect(workflow.image.fr).toMatch(/^\/workflows\/.+-fr\.svg$/);
      expect(workflow.title.en).not.toBe("");
      expect(workflow.title.fr).not.toBe("");
    }
  });

  it("uses the stock-only overview for contextual setup pages", () => {
    const workflow = workflowsForPathname("/inventory")[0];
    expect(workflow.image.en).toBe("/workflows/stock-management-overview-context.svg");
    expect(workflow.image.fr).toBe("/workflows/stock-management-overview-context-fr.svg");
  });
});
