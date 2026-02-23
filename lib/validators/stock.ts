import { z } from "zod";

export const createStockMovementSchema = z.object({
  material_id: z.string().uuid(),
  location_id: z.string().uuid(),
  quantity_delta: z.number().refine((value) => value !== 0, "quantity_delta cannot be zero"),
  reason: z.enum(["adjustment", "transfer_in", "transfer_out", "purchase_receive", "correction"]).default("adjustment"),
  note: z.string().max(1000).optional(),
  reference_type: z.string().max(80).optional(),
  reference_id: z.string().uuid().optional()
});
