export type MaterialDraftRequiredField = "sku" | "name" | "minStock";

export type MaterialDraftRequiredValues = {
  sku: string;
  name: string;
  minStock: string | number;
};

export { materialDuplicateSkuMessage } from "@/lib/material-errors";

export function validateMaterialDraftRequiredFields(values: MaterialDraftRequiredValues): MaterialDraftRequiredField[] {
  const missing: MaterialDraftRequiredField[] = [];

  if (!values.sku.trim()) {
    missing.push("sku");
  }

  if (!values.name.trim()) {
    missing.push("name");
  }

  if (String(values.minStock).trim() === "") {
    missing.push("minStock");
  }

  return missing;
}
