import { describe, expect, it } from "vitest";
import { z } from "zod";
import { handleApiError } from "@/lib/api/errors";
import { batchSchema } from "@/lib/validators/replenishment";

describe("API validation error contract", () => {
  it("returns HTTP 400 with field errors and a correlation ID", async () => {
    const result = z.object({ name: z.string().min(1) }).safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (result.success) return;
    const response = handleApiError(result.error);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body).toMatchObject({ error: "Validation failed.", code: "validation_failed", details: { formErrors: [], fieldErrors: { name: [expect.any(String)] } } });
    expect(body.requestId).toBe(response.headers.get("x-request-id"));
    expect(body.requestId).toEqual(expect.any(String));
  });

  it("rejects invalid replenishment quantities without returning raw input values", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const result = batchSchema.safeParse({ request_id: id, required_by: "2026-11-05", timezone: "UTC", rows: [{ material_id: id, supplier_id: id, currency: "EUR", quantity: "1.0001", snapshot_token: "private-snapshot-token" }] });
    expect(result.success).toBe(false);
    if (result.success) return;
    const response = handleApiError(result.error);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.details.fieldErrors.rows).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(JSON.stringify(body)).not.toContain("private-snapshot-token");
  });

  it("rejects an oversized batch before accumulating errors for every invalid row", () => {
    const result = batchSchema.safeParse({ request_id: "11111111-1111-4111-8111-111111111111", required_by: "2026-11-05", timezone: "UTC", rows: Array.from({ length: 1000 }, () => ({})) });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toEqual([expect.objectContaining({ code: "too_big", path: ["rows"] })]);
  });
});
