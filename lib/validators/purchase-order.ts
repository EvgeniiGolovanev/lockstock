import { z } from "zod";

export const createPurchaseOrderSchema = z.object({
  supplier_id: z.string().uuid(),
  currency: z.enum(["EUR", "USD"]).default("EUR"),
  po_number: z.string().max(100).optional(),
  expected_at: z.string().date().optional(),
  notes: z.string().max(2000).optional(),
  lines: z
    .array(
      z.object({
        material_id: z.string().uuid(),
        quantity_ordered: z.number().positive(),
        unit_price: z.number().min(0).optional()
      })
    )
    .min(1)
});

export const receivePurchaseOrderSchema = z.object({
  receipts: z
    .array(
      z.object({
        po_line_id: z.string().uuid(),
        location_id: z.string().uuid(),
        quantity_received: z.number().positive()
      })
    )
    .min(1)
});

export const transitionPurchaseOrderStatusSchema = z.object({
  status: z.literal("sent")
});
