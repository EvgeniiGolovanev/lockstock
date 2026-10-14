import { afterEach, describe, expect, it, vi } from "vitest";
import { handleApiError } from "@/lib/api/errors";
import { mapInventoryError } from "@/lib/api/inventory-errors";

afterEach(() => vi.restoreAllMocks());

describe("inventory database error contract", () => {
  it.each([
    ["23514", "Insufficient stock for this movement", 409, "Not enough quantity at the specified location."],
    ["P0001", "Purchase order must be sent before receiving", 409, "Purchase order must be sent before receiving."],
    ["P0001", "Receiving quantity exceeds quantity_ordered for line 1477645d-65e2-42fe-b5b6-d64dad99b3e9", 409, "Receiving quantity exceeds the outstanding quantity on this purchase order line."],
    ["P0001", "PO line does not exist in this purchase order", 422, "The receipt line does not belong to this purchase order."],
    ["42501", "Location must be active in this organization", 422, "Location is unavailable or blocked for usage."],
    ["42501", "Material must be active in this organization", 422, "Material is unavailable or blocked for usage."],
    ["22003", "quantity_received must be finite", 422, "Quantity must be a finite number."],
    ["22003", "quantity must be finite", 422, "Quantity must be a finite number."],
    ["22003", "quantity_delta must be finite", 422, "Quantity must be a finite number."],
    ["22023", "quantity_delta cannot be zero", 422, "Quantity cannot be zero."],
    ["P0001", "quantity_received must be greater than zero", 422, "Quantity must be greater than zero."],
    ["P0001", "quantity must be greater than zero", 422, "Quantity must be greater than zero."],
    ["P0001", "Transfer locations must be different", 422, "Transfer locations must be different."],
    ["P0001", "Purchase order not found in this organization", 404, "Purchase order not found."]
  ])("maps %s / %s without exposing database details", async (code, message, status, publicMessage) => {
    const response = handleApiError(mapInventoryError({ code, message, details: "private SQL", hint: "secret" }));
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body.error).toBe(publicMessage);
    expect(body.code).toBe(status === 409 ? "conflict" : status === 404 ? "not_found" : "validation_failed");
    expect(response.headers.get("x-request-id")).toBe(body.requestId);
    expect(JSON.stringify(body)).not.toMatch(/private SQL|secret|1477645d/);
  });

  it.each([
    null, "unavailable", new Error("Insufficient stock for this movement"),
    { code: "XX000", message: "Insufficient stock for this movement" },
    { code: "23514", message: "private database constraint" },
    { code: "42501", message: "This action requires member role or higher" },
    { code: "P0001", message: "Receiving quantity exceeds quantity_ordered for line secret SQL" }
  ])("preserves unknown errors for the generic 500 handler", async error => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mapInventoryError(error)).toBe(error);
    const response = handleApiError(mapInventoryError(error));
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe("Unexpected server error.");
  });
});
