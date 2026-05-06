import { describe, expect, it } from "vitest";
import { createLocationSchema, updateLocationSchema } from "@/lib/validators/location";

describe("createLocationSchema", () => {
  it("accepts a trimmed address up to 265 characters", () => {
    const parsed = createLocationSchema.parse({
      name: "Main Warehouse",
      code: "MAIN",
      address: "  221B Baker Street  "
    });

    expect(parsed.address).toBe("221B Baker Street");
  });

  it("allows a blank address", () => {
    const parsed = createLocationSchema.parse({
      name: "Main Warehouse",
      address: "   "
    });

    expect(parsed.address).toBe("");
  });

  it("rejects addresses longer than 265 characters", () => {
    expect(() =>
      createLocationSchema.parse({
        name: "Main Warehouse",
        address: "A".repeat(266)
      })
    ).toThrow();
  });
});

describe("updateLocationSchema", () => {
  it("accepts partial active state updates", () => {
    const parsed = updateLocationSchema.parse({
      is_active: false
    });

    expect(parsed.is_active).toBe(false);
  });

  it("rejects empty updates", () => {
    expect(() => updateLocationSchema.parse({})).toThrow();
  });
});
