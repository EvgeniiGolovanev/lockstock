import { describe, expect, it } from "vitest";
import { formatDateLabel, formatDateTimeLabel, formatNumberLabel } from "@/lib/ui/formatters";

describe("UI formatters", () => {
  it("formats dates as DD/MM/YYYY", () => {
    expect(formatDateLabel(new Date(2026, 4, 5))).toBe("05/05/2026");
    expect(formatDateLabel(null)).toBe("-");
  });

  it("formats date-times with DD/MM/YYYY date first", () => {
    expect(formatDateTimeLabel(new Date(2026, 4, 5, 9, 7, 3))).toBe("05/05/2026 09:07:03");
  });

  it("formats thousands with spaces", () => {
    expect(formatNumberLabel(1234567.89)).toBe("1 234 567.89");
    expect(formatNumberLabel(1000)).toBe("1 000");
  });
});
