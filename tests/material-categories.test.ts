import { describe, expect, it } from "vitest";
import {
  MATERIAL_CATEGORIES,
  getMaterialSubcategories,
  isValidMaterialSubcategory
} from "@/lib/material-categories";

describe("material categories", () => {
  it("returns subcategories for a known category", () => {
    expect(MATERIAL_CATEGORIES).toContain("Electrical");
    expect(getMaterialSubcategories("Electrical")).toEqual([
      "Cables & wiring",
      "Switches & sockets",
      "Electrical panels & protection",
      "Smart home / domotics"
    ]);
  });

  it("validates category/subcategory pairs", () => {
    expect(isValidMaterialSubcategory("Electrical", "Cables & wiring")).toBe(true);
    expect(isValidMaterialSubcategory("Electrical", "Pipes & tubes")).toBe(false);
  });
});
