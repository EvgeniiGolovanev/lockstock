import { describe, expect, it } from "vitest";
import { summarizeAuditMetadata } from "@/lib/ui/audit-log";

describe("audit log metadata summaries", () => {
  it("summarizes changed fields with old and new values", () => {
    expect(
      summarizeAuditMetadata({
        changed_fields: ["status", "is_active"],
        old_values: { status: "draft", is_active: true },
        new_values: { status: "sent", is_active: false }
      })
    ).toEqual(["Changed: status, is active", "status: draft -> sent", "is active: true -> false"]);
  });

  it("adds related entity labels without exposing raw metadata blobs", () => {
    expect(
      summarizeAuditMetadata({
        material: { sku: "MAT-001", name: "Cement" },
        location: { code: "MAIN", name: "Main Warehouse" },
        quantity_delta: "-5",
        reason: "adjustment",
        actor_email: "manager@example.com"
      })
    ).toEqual([
      "Material: MAT-001 - Cement",
      "Location: MAIN - Main Warehouse",
      "Movement: -5 - adjustment",
      "By: manager@example.com"
    ]);
  });
});
