import { z } from "zod";

export const createLocationSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().max(32).optional(),
  is_active: z.boolean().default(true)
});
