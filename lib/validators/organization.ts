import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(160),
  plan: z.enum(["starter", "operations", "business", "enterprise"]).default("starter")
});

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(160)
});
