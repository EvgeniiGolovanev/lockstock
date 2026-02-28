import { describe, expect, it } from "vitest";
import { createPurchaseOrderSchema } from "@/lib/validators/purchase-order";

describe("createPurchaseOrderSchema currency", () => {
  const basePayload = {
    supplier_id: "11111111-1111-4111-8111-111111111111",
    lines: [
      {
        material_id: "22222222-2222-4222-8222-222222222222",
        quantity_ordered: 2,
        unit_price: 10.5
      }
    ]
  };

  it("defaults currency to EUR when missing", () => {
    const parsed = createPurchaseOrderSchema.parse(basePayload);
    expect(parsed.currency).toBe("EUR");
  });

  it("accepts USD currency", () => {
    const parsed = createPurchaseOrderSchema.parse({ ...basePayload, currency: "USD" });
    expect(parsed.currency).toBe("USD");
  });

  it("rejects unsupported currency values", () => {
    expect(() => createPurchaseOrderSchema.parse({ ...basePayload, currency: "GBP" })).toThrow();
  });
});
