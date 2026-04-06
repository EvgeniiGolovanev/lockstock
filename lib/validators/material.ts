import { z } from "zod";
import { MATERIAL_CATEGORIES, isValidMaterialSubcategory } from "@/lib/material-categories";

export const createMaterialSchema = z
  .object({
    sku: z.string().min(1).max(80),
    name: z.string().min(1).max(160),
    description: z.string().max(256).optional(),
    uom: z.string().min(1).max(30).default("unit"),
    category: z.enum(MATERIAL_CATEGORIES),
    subcategory: z.string().min(1).max(160),
    min_stock: z.number().min(0).default(0),
    is_active: z.boolean().default(true)
  })
  .superRefine((value, context) => {
    if (!isValidMaterialSubcategory(value.category, value.subcategory)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Subcategory does not belong to selected category.",
        path: ["subcategory"]
      });
    }
  });
