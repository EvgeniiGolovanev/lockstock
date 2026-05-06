import { z } from "zod";

export const createLocationSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().max(32).optional(),
  address: z.string().trim().max(265).optional(),
  is_active: z.boolean().default(true)
});

export const updateLocationSchema = createLocationSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one location field is required."
});
