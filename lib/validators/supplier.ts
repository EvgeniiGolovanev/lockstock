import { z } from "zod";

export const createSupplierSchema = z.object({
  name: z.string().min(1).max(160),
  email: z.string().email().optional(),
  phone: z.string().max(60).optional(),
  lead_time_days: z.number().int().min(0).max(365).default(0),
  payment_terms: z.string().max(200).optional(),
  is_active: z.boolean().default(true)
});
