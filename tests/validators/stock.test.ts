import { describe, expect, it } from "vitest";
import { createStockMovementSchema } from "@/lib/validators/stock";

describe("createStockMovementSchema", () => {
  const baseUuid = {
    material_id: "11111111-1111-4111-8111-111111111111",
    location_id: "22222222-2222-4222-8222-222222222222",
    from_location_id: "33333333-3333-4333-8333-333333333333",
    to_location_id: "44444444-4444-4444-8444-444444444444"
  };

  it("accepts manual adjustment movements with a comment", () => {
    const parsed = createStockMovementSchema.parse({
      material_id: baseUuid.material_id,
      location_id: baseUuid.location_id,
      quantity_delta: 5,
      reason: "adjustment",
      note: "Cycle count update"
    });

    expect(parsed.reason).toBe("adjustment");
    expect(parsed.note).toBe("Cycle count update");
  });

  it("accepts transfer movements with source and destination locations", () => {
    const parsed = createStockMovementSchema.parse({
      material_id: baseUuid.material_id,
      from_location_id: baseUuid.from_location_id,
      to_location_id: baseUuid.to_location_id,
      quantity: 7,
      reason: "transfer",
      note: "Move to overflow rack"
    });

    expect(parsed.reason).toBe("transfer");
    if (parsed.reason !== "transfer") {
      throw new Error("Expected transfer movement");
    }
    expect(parsed.quantity).toBe(7);
  });

  it("rejects manual purchase receive and correction reasons", () => {
    expect(() =>
      createStockMovementSchema.parse({
        material_id: baseUuid.material_id,
        location_id: baseUuid.location_id,
        quantity_delta: 1,
        reason: "purchase_receive"
      })
    ).toThrow();

    expect(() =>
      createStockMovementSchema.parse({
        material_id: baseUuid.material_id,
        location_id: baseUuid.location_id,
        quantity_delta: 1,
        reason: "correction"
      })
    ).toThrow();
  });
});
