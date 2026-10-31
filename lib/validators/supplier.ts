import { z } from "zod";

const optionalTrimmedString = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

const phoneSchema = optionalTrimmedString(60).refine(
  (value) => !value || /^\+\d{1,4}(?:[\s().-]*\d){4,20}$/.test(value),
  "Phone must include a country code."
);

const supplierSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().optional(),
  phone: phoneSchema,
  address: optionalTrimmedString(256),
  lead_time_days: z.coerce.number().int().min(0).max(365),
  payment_terms: optionalTrimmedString(200),
  is_active: z.boolean()
});

export const createSupplierSchema = supplierSchema.extend({
  lead_time_days: supplierSchema.shape.lead_time_days.default(0),
  is_active: supplierSchema.shape.is_active.default(true)
});
export const updateSupplierSchema = supplierSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one supplier field is required."
});
