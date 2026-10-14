import { ApiError } from "@/lib/api/errors";

// Only translate known RPC failures. SQL details and unknown errors stay private
// in the generic handler; a SQLSTATE alone is not a business-error contract.
const failures: Array<[string, string | RegExp, number, string]> = [
  ["23514", "Insufficient stock for this movement", 409, "Not enough quantity at the specified location."],
  ["P0001", "Purchase order must be sent before receiving", 409, "Purchase order must be sent before receiving."],
  ["P0001", /^Receiving quantity exceeds quantity_ordered for line [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 409, "Receiving quantity exceeds the outstanding quantity on this purchase order line."],
  ["P0001", "PO line does not exist in this purchase order", 422, "The receipt line does not belong to this purchase order."],
  ["42501", "Location must be active in this organization", 422, "Location is unavailable or blocked for usage."],
  ["42501", "Material must be active in this organization", 422, "Material is unavailable or blocked for usage."],
  ["22003", /^(quantity|quantity_delta|quantity_received) must be finite$/, 422, "Quantity must be a finite number."],
  ["22023", "quantity_delta cannot be zero", 422, "Quantity cannot be zero."],
  ["P0001", /^(quantity|quantity_received) must be greater than zero$/, 422, "Quantity must be greater than zero."],
  ["P0001", "Transfer locations must be different", 422, "Transfer locations must be different."],
  ["P0001", "Purchase order not found in this organization", 404, "Purchase order not found."]
];

export function mapInventoryError(error: unknown): unknown {
  if (typeof error !== "object" || error === null || !("code" in error) || !("message" in error) || typeof error.message !== "string") return error;
  const failure = failures.find(([code, pattern]) => code === error.code &&
    (typeof pattern === "string" ? pattern === error.message : pattern.test(error.message as string)));
  if (failure) return new ApiError(failure[2], failure[3]);
  return error;
}
