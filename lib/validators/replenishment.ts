import { z } from "zod";

const decimal = z.string().regex(/^\d{1,11}(\.\d{1,3})?$/, "Use a non-negative quantity with up to three decimals.");
const date = z.string().date();
const timezone = z.string().refine(value => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; } catch { return false; }
}, "Invalid timezone");
export function planningQuery(required_by: string, zone: string, now = new Date()) {
  const parsed = z.object({ required_by: date, timezone }).parse({ required_by, timezone: zone });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const last = new Date(`${today}T12:00:00Z`); last.setUTCDate(last.getUTCDate() + 365);
  if (required_by < today || required_by > last.toISOString().slice(0, 10)) throw new Error("Planning date must be within the next 365 days.");
  return parsed;
}
export const settingsSchema = z.object({
  material_id: z.string().uuid(), min_stock: decimal,
  target_stock: decimal.nullable(), supplier_id: z.string().uuid().nullable(), currency: z.enum(["EUR","USD"]).default("EUR")
}).strict().refine(v => v.target_stock === null || Number(v.target_stock) >= Number(v.min_stock), { message: "Target must be at least minimum", path: ["target_stock"] });
export const batchSchema = z.object({
  request_id: z.string().uuid(), required_by: date, timezone,
  rows: z.array(z.object({
    material_id: z.string().uuid(), snapshot_token: z.string().min(1), supplier_id: z.string().uuid(),
    currency: z.enum(["EUR", "USD"]), quantity: decimal.refine(v => Number(v) > 0),
    unit_price: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/).nullable().optional(),
    expected_at: date.nullable().optional(), acknowledge_incoming: z.boolean().default(false)
  }).strict()).min(1).max(100)
}).strict().refine(v => new Set(v.rows.map(r => r.material_id)).size === v.rows.length, "Duplicate material selection")
  .refine(v => new Set(v.rows.map(r => `${r.supplier_id}:${r.currency}`)).size <= 20, "Maximum 20 order groups");

export type DraftInput = z.infer<typeof batchSchema>;
