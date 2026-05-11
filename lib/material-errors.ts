import type { Locale } from "@/lib/i18n";

export const MATERIAL_DUPLICATE_SKU_ERROR = "This material number already exists.";

const MATERIAL_DUPLICATE_SKU_MESSAGES: Record<Locale, string> = {
  en: MATERIAL_DUPLICATE_SKU_ERROR,
  fr: "Ce numéro de matériel existe déjà."
};

type DatabaseErrorLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

export function materialDuplicateSkuMessage(locale: Locale) {
  return MATERIAL_DUPLICATE_SKU_MESSAGES[locale];
}

export function isDuplicateMaterialSkuError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const databaseError = error as DatabaseErrorLike;
  if (databaseError.code !== "23505") {
    return false;
  }

  const text = `${String(databaseError.message ?? "")} ${String(databaseError.details ?? "")}`.toLowerCase();
  return text.includes("sku") || text.includes("materials_org_id_sku") || text.includes("materials_org_id_sku_key");
}
