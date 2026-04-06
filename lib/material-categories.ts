export const MATERIAL_CATEGORIES = [
  "Structural & Building Materials",
  "Finishing Materials",
  "Plumbing",
  "Electrical",
  "HVAC (Heating / Cooling / Ventilation)",
  "Tools & Equipment",
  "Hardware & Fixings",
  "Woodwork & Openings",
  "Kitchen & Bath",
  "Storage & Interior Fittings",
  "Lighting",
  "Outdoor & Site",
  "Consumables"
] as const;

export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export const MATERIAL_SUBCATEGORY_BY_CATEGORY: Record<MaterialCategory, readonly string[]> = {
  "Structural & Building Materials": [
    "Concrete & cement",
    "Masonry (blocks, bricks)",
    "Wood & panels",
    "Metal & profiles",
    "Insulation"
  ],
  "Finishing Materials": [
    "Flooring (tiles, parquet, vinyl)",
    "Wall coverings (paint, wallpaper)",
    "Ceilings & panels",
    "Facade & exterior finishing"
  ],
  Plumbing: ["Pipes & tubes", "Fittings & connectors", "Valves & controls", "Sanitary equipment"],
  Electrical: [
    "Cables & wiring",
    "Switches & sockets",
    "Electrical panels & protection",
    "Smart home / domotics"
  ],
  "HVAC (Heating / Cooling / Ventilation)": [
    "Heating systems",
    "Ventilation",
    "Air conditioning",
    "Radiators & accessories"
  ],
  "Tools & Equipment": ["Power tools", "Hand tools", "Construction equipment", "Measuring tools"],
  "Hardware & Fixings": ["Screws, bolts, anchors", "Hinges & brackets", "Locks & security", "Small metal parts"],
  "Woodwork & Openings": ["Doors", "Windows", "Frames", "Shutters"],
  "Kitchen & Bath": [
    "Kitchen units",
    "Worktops",
    "Bathroom furniture",
    "Fixtures (sinks, showers)",
    "Showers and bathtubs",
    "Sinks and basins",
    "Sanitary accessories"
  ],
  "Storage & Interior Fittings": ["Shelving systems", "Cabinets", "Closet systems"],
  Lighting: ["Indoor lighting", "Outdoor lighting", "Bulbs & accessories"],
  "Outdoor & Site": ["Garden materials", "Fencing & gates", "Landscaping materials", "Outdoor structures"],
  Consumables: ["Adhesives & sealants", "Chemicals", "Cleaning products", "Protective materials"]
};

export function getMaterialSubcategories(category: MaterialCategory): readonly string[] {
  return MATERIAL_SUBCATEGORY_BY_CATEGORY[category];
}

export function isValidMaterialSubcategory(category: MaterialCategory, subcategory: string): boolean {
  return MATERIAL_SUBCATEGORY_BY_CATEGORY[category].includes(subcategory);
}
