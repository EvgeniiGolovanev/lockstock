import { describe, expect, it } from "vitest";
import { createMaterialSchema, updateMaterialSchema } from "@/lib/validators/material";

describe("createMaterialSchema", () => {
  const basePayload = {
    sku: "MAT-001",
    name: "Cement",
    uom: "bag",
    min_stock: 10,
    category: "Structural & Building Materials",
    subcategory: "Concrete & cement"
  };

  it("accepts valid category, subcategory, and description", () => {
    const parsed = createMaterialSchema.parse({
      ...basePayload,
      description: "Gray cement for slab work"
    });

    expect(parsed.category).toBe("Structural & Building Materials");
    expect(parsed.subcategory).toBe("Concrete & cement");
    expect(parsed.description).toBe("Gray cement for slab work");
  });

  it("rejects a subcategory that does not belong to the selected category", () => {
    expect(() =>
      createMaterialSchema.parse({
        ...basePayload,
        category: "Electrical",
        subcategory: "Concrete & cement"
      })
    ).toThrow();
  });

  it("rejects descriptions longer than 256 characters", () => {
    expect(() =>
      createMaterialSchema.parse({
        ...basePayload,
        description: "x".repeat(257)
      })
    ).toThrow();
  });
});

describe("updateMaterialSchema", () => {
  it("accepts editable material catalog fields", () => {
    const parsed = updateMaterialSchema.parse({
      name: "Concrete mix",
      category: "Structural & Building Materials",
      subcategory: "Concrete & cement",
      min_stock: 12,
      description: "Ready-mix bags"
    });

    expect(parsed).toEqual({
      name: "Concrete mix",
      category: "Structural & Building Materials",
      subcategory: "Concrete & cement",
      min_stock: 12,
      description: "Ready-mix bags"
    });
  });

  it("rejects immutable material number and uom fields", () => {
    expect(() =>
      updateMaterialSchema.parse({
        sku: "MAT-002",
        uom: "BOX"
      })
    ).toThrow();
  });
});
