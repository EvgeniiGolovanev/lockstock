import { z } from "zod";

const stockMovementNoteSchema = z.string().max(1000).optional();

const adjustmentMovementSchema = z.object({
  material_id: z.string().uuid(),
  location_id: z.string().uuid(),
  quantity_delta: z.number().refine((value) => value !== 0, "quantity_delta cannot be zero"),
  reason: z.enum(["adjustment"]).default("adjustment"),
  note: stockMovementNoteSchema,
  reference_type: z.string().max(80).optional(),
  reference_id: z.string().uuid().optional()
});

const transferMovementSchema = z
  .object({
    material_id: z.string().uuid(),
    from_location_id: z.string().uuid(),
    to_location_id: z.string().uuid(),
    quantity: z.number().positive("quantity must be greater than zero"),
    reason: z.literal("transfer"),
    note: stockMovementNoteSchema
  })
  .superRefine((value, context) => {
    if (value.from_location_id === value.to_location_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Transfer locations must be different.",
        path: ["to_location_id"]
      });
    }
  });

export const createStockMovementSchema = z.union([adjustmentMovementSchema, transferMovementSchema]);
