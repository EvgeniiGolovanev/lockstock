import { z } from "zod";

export const createMaterialSchema = z.object({
  sku: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  uom: z.string().min(1).max(30).default("unit"),
  min_stock: z.number().min(0).default(0),
  is_active: z.boolean().default(true)
});
