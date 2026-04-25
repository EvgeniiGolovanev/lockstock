import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHONE_COUNTRY_CODE,
  buildPhoneNumber,
  formatVendorNumber,
  splitPhoneNumber
} from "@/lib/ui/vendor-fields";

describe("vendor field helpers", () => {
  it("renders vendor numbers as zero-padded eight-digit values", () => {
    expect(formatVendorNumber(1)).toBe("00000001");
    expect(formatVendorNumber(12345678)).toBe("12345678");
    expect(formatVendorNumber(null)).toBe("");
  });

  it("splits stored phone numbers into country code and local number", () => {
    expect(splitPhoneNumber("+33 6 12 34 56 78")).toEqual({
      countryCode: "+33",
      localNumber: "6 12 34 56 78"
    });
  });

  it("falls back to the default country code when a stored value has no prefix", () => {
    expect(splitPhoneNumber("06 12 34 56 78")).toEqual({
      countryCode: DEFAULT_PHONE_COUNTRY_CODE,
      localNumber: "06 12 34 56 78"
    });
  });

  it("builds normalized phone values for persistence", () => {
    expect(buildPhoneNumber("+33", " 6 12 34 56 78 ")).toBe("+33 6 12 34 56 78");
    expect(buildPhoneNumber("+33", "   ")).toBeUndefined();
  });
});
