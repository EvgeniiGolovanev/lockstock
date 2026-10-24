import { z } from "zod";

const locationSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().max(32).optional(),
  address: z.string().trim().max(265).optional(),
  is_active: z.boolean()
});

export const createLocationSchema = locationSchema.extend({
  is_active: locationSchema.shape.is_active.default(true)
});

export const updateLocationSchema = locationSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one location field is required."
});
