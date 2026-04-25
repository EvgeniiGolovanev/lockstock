import { describe, expect, it } from "vitest";
import { createSupplierSchema } from "@/lib/validators/supplier";

describe("createSupplierSchema", () => {
  it("accepts phone numbers that include a country code and trims address fields", () => {
    const parsed = createSupplierSchema.parse({
      name: "  Acme Supply  ",
      phone: "  +33 6 12 34 56 78  ",
      address: "  221B Baker Street  ",
      lead_time_days: 5
    });

    expect(parsed.name).toBe("Acme Supply");
    expect(parsed.phone).toBe("+33 6 12 34 56 78");
    expect(parsed.address).toBe("221B Baker Street");
  });

  it("allows blank phone and address values", () => {
    const parsed = createSupplierSchema.parse({
      name: "Vendor",
      phone: "   ",
      address: "   "
    });

    expect(parsed.phone).toBeUndefined();
    expect(parsed.address).toBeUndefined();
  });

  it("rejects phone numbers without a country code", () => {
    expect(() =>
      createSupplierSchema.parse({
        name: "Vendor",
        phone: "06 12 34 56 78"
      })
    ).toThrow("Phone must include a country code.");
  });

  it("rejects addresses longer than 256 characters", () => {
    expect(() =>
      createSupplierSchema.parse({
        name: "Vendor",
        address: "A".repeat(257)
      })
    ).toThrow();
  });
});
