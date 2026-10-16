import { describe, expect, it } from "vitest";
import { supplierSearchFilter } from "@/lib/api/supplier-search";

describe("supplier search", () => {
  it("uses text filters without unsupported numeric-column casts", () => {
    expect(supplierSearchFilter("Acme")).toBe('name.ilike."%Acme%",phone.ilike."%Acme%",address.ilike."%Acme%"');
  });
  it.each(["42", "00000042"])("finds the complete numeric vendor ID %s", query => {
    expect(supplierSearchFilter(query)).toContain(",vendor_number.eq.42");
  });
  it.each(["0", "-1", "42foo", "100000000", "33612345678", "9007199254740992"])("does not send an invalid numeric comparison for %s", query => {
    expect(supplierSearchFilter(query)).not.toContain("vendor_number");
  });
  it("keeps reserved characters inside a quoted PostgREST value", () => {
    expect(supplierSearchFilter('Acme, (Paris) "A"\\B')).toBe('name.ilike."%Acme, (Paris) \\"A\\"\\\\B%",phone.ilike."%Acme, (Paris) \\"A\\"\\\\B%",address.ilike."%Acme, (Paris) \\"A\\"\\\\B%"');
  });
});
