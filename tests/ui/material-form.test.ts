import { describe, expect, it } from "vitest";
import { materialDuplicateSkuMessage, validateMaterialDraftRequiredFields } from "@/lib/ui/material-form";

describe("material form helpers", () => {
  it("accepts filled required fields", () => {
    expect(validateMaterialDraftRequiredFields({ sku: "MAT-001", name: "Cement", minStock: "0" })).toEqual([]);
  });

  it("marks blank sku, name, and minimum stock as missing", () => {
    expect(validateMaterialDraftRequiredFields({ sku: " ", name: "", minStock: "" })).toEqual(["sku", "name", "minStock"]);
  });

  it("returns localized duplicate material number messages", () => {
    expect(materialDuplicateSkuMessage("en")).toBe("This material number already exists.");
    expect(materialDuplicateSkuMessage("fr")).toBe("Ce numéro de matériel existe déjà.");
  });
});
