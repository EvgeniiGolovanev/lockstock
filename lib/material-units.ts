export type MaterialUnit = {
  code: string;
  label: string;
  english: string;
};

export const MATERIAL_UNITS = [
  { code: "BOX", label: "Boîte", english: "Box" },
  { code: "CARTON", label: "Carton", english: "Carton" },
  { code: "CM", label: "Centimètre", english: "Centimeter" },
  { code: "DRUM", label: "Fût", english: "Drum" },
  { code: "GAL", label: "Gallon", english: "Gallon" },
  { code: "G", label: "Gramme", english: "Gram" },
  { code: "KG", label: "Kilogramme", english: "Kilogram" },
  { code: "L", label: "Litre", english: "Liter" },
  { code: "LOT", label: "Lot", english: "Lot" },
  { code: "M", label: "Mètre", english: "Meter" },
  { code: "M2", label: "Mètre carré", english: "Square meter" },
  { code: "M3", label: "Mètre cube", english: "Cubic meter" },
  { code: "ML", label: "Millilitre", english: "Milliliter" },
  { code: "MM", label: "Millimètre", english: "Millimeter" },
  { code: "PALLET", label: "Palette", english: "Pallet" },
  { code: "PACK", label: "Paquet", english: "Pack" },
  { code: "PC", label: "Pièce", english: "Piece / Each" },
  { code: "ROLL", label: "Rouleau", english: "Roll" },
  { code: "BAG", label: "Sac", english: "Bag" },
  { code: "T", label: "Tonne", english: "Metric tonne" }
] as const satisfies readonly MaterialUnit[];

const MATERIAL_UNIT_LABELS: ReadonlyMap<string, string> = new Map(MATERIAL_UNITS.map((unit) => [unit.code, unit.label]));

export function formatMaterialUnitLabel(value: string) {
  return MATERIAL_UNIT_LABELS.get(value) ?? value;
}
