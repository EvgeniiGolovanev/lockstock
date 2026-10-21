import { describe, expect, it } from "vitest";
import { batchSchema, settingsSchema, planningQuery } from "@/lib/validators/replenishment";
import { updateMaterialSchema } from "@/lib/validators/material";

const id = "11111111-1111-4111-8111-111111111111";
const row = { material_id: id, snapshot_token: "abc", supplier_id: id, currency: "EUR", quantity: "3.500", acknowledge_incoming: false };
describe("replenishment input", () => {
  it("preserves fractional quantities as decimal strings", () => {
    expect(batchSchema.parse({ request_id: id, required_by: "2026-10-30", timezone: "Europe/Paris", rows: [row] }).rows[0].quantity).toBe("3.500");
  });
  it.each(["0", "-1", "1.0001", "Infinity", "1e3", "99999999999999999"])("rejects invalid quantity %s", quantity => {
    expect(batchSchema.safeParse({ request_id: id, required_by: "2026-10-30", timezone: "Europe/Paris", rows: [{ ...row, quantity }] }).success).toBe(false);
  });
  it("rejects duplicated material selections", () => {
    expect(batchSchema.safeParse({ request_id: id, required_by: "2026-10-30", timezone: "Europe/Paris", rows: [row, row] }).success).toBe(false);
  });
  it("validates timezone and bounds date in the user's calendar", () => {
    expect(() => planningQuery("2026-10-20", "Europe/Paris", new Date("2026-10-21T10:00:00Z"))).toThrow();
    expect(() => planningQuery("2026-10-22", "Bad/Zone")).toThrow();
    expect(planningQuery("2026-10-22", "Europe/Paris", new Date("2026-10-20T23:30:00Z"))).toEqual({ required_by: "2026-10-22", timezone: "Europe/Paris" });
  });
  it("requires target >= minimum without inventing a multiplier", () => {
    expect(settingsSchema.safeParse({ material_id: id, min_stock: "10", target_stock: "9", supplier_id: id }).success).toBe(false);
    expect(settingsSchema.parse({ material_id: id, min_stock: "10", target_stock: null, supplier_id: id }).target_stock).toBeNull();
  });
  it("accepts a material target update and rejects a target below a supplied minimum", () => {
    expect(updateMaterialSchema.safeParse({ min_stock: 10, target_stock: 50 }).success).toBe(true);
    expect(updateMaterialSchema.safeParse({ min_stock: 10, target_stock: 9 }).success).toBe(false);
  });
  it("accepts an explicit purchasing currency in supplier settings", () => {
    expect(settingsSchema.parse({ material_id: id, min_stock: "10", target_stock: "50", supplier_id: id, currency: "USD" }).currency).toBe("USD");
  });
});
