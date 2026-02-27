import { describe, expect, it } from "vitest";
import { buildAccountMetadata, validatePasswordChange } from "@/lib/auth/account";

describe("account helpers", () => {
  it("builds auth metadata payload with trimmed values", () => {
    expect(
      buildAccountMetadata({
        fullName: "  Alex Doe ",
        company: " LockStock Inc ",
        phone: " +1 555-0100 ",
        jobTitle: " Operations Lead "
      })
    ).toEqual({
      full_name: "Alex Doe",
      company: "LockStock Inc",
      phone: "+1 555-0100",
      job_title: "Operations Lead"
    });
  });

  it("uses nulls for cleared metadata fields so profile values can be removed", () => {
    expect(
      buildAccountMetadata({
        fullName: "  ",
        company: "",
        phone: "   ",
        jobTitle: ""
      })
    ).toEqual({
      full_name: null,
      company: null,
      phone: null,
      job_title: null
    });
  });

  it("validates password change requirements", () => {
    expect(validatePasswordChange("", "")).toBe("New password is required.");
    expect(validatePasswordChange("short", "short")).toBe("Password must be at least 8 characters.");
    expect(validatePasswordChange("new-password-123", "new-password-12")).toBe("Password confirmation does not match.");
    expect(validatePasswordChange("new-password-123", "new-password-123")).toBeNull();
  });
});
