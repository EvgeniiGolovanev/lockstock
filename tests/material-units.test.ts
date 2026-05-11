import { describe, expect, it } from "vitest";
import { MATERIAL_UNITS, formatMaterialUnitLabel } from "@/lib/material-units";

describe("material units", () => {
  it("defines the approved 20 French unit labels in alphabetical order", () => {
    expect(MATERIAL_UNITS).toHaveLength(20);
    expect(MATERIAL_UNITS.map((unit) => unit.label)).toEqual([
      "Boîte",
      "Carton",
      "Centimètre",
      "Fût",
      "Gallon",
      "Gramme",
      "Kilogramme",
      "Litre",
      "Lot",
      "Mètre",
      "Mètre carré",
      "Mètre cube",
      "Millilitre",
      "Millimètre",
      "Palette",
      "Paquet",
      "Pièce",
      "Rouleau",
      "Sac",
      "Tonne"
    ]);
  });

  it("formats known unit codes as French labels and preserves custom units", () => {
    expect(formatMaterialUnitLabel("BAG")).toBe("Sac");
    expect(formatMaterialUnitLabel("custom")).toBe("custom");
  });

  it("formats known unit codes as English labels when English is active", () => {
    expect(formatMaterialUnitLabel("BAG", "en")).toBe("Bag");
    expect(formatMaterialUnitLabel("M2", "en")).toBe("Square meter");
    expect(formatMaterialUnitLabel("custom", "en")).toBe("custom");
  });
});
