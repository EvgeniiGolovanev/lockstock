import { describe, expect, it } from "vitest";
import { compareAlphaNumeric, paginateRows, sortRowsByKey, tableRowsToCsv, totalPagesForRows } from "@/lib/ui/table-tools";

describe("table tools", () => {
  it("sorts strings with numeric segments alphanumerically", () => {
    const rows = [{ code: "MAT-10" }, { code: "MAT-2" }, { code: "MAT-1" }];

    expect(sortRowsByKey(rows, { key: "code", direction: "asc" }, (row, key) => row[key]).map((row) => row.code)).toEqual([
      "MAT-1",
      "MAT-2",
      "MAT-10"
    ]);
    expect(compareAlphaNumeric("a2", "a10")).toBeLessThan(0);
  });

  it("sorts descending without mutating the original rows", () => {
    const rows = [{ name: "Beta" }, { name: "Alpha" }];
    const sorted = sortRowsByKey(rows, { key: "name", direction: "desc" }, (row, key) => row[key]);

    expect(sorted.map((row) => row.name)).toEqual(["Beta", "Alpha"]);
    expect(rows.map((row) => row.name)).toEqual(["Beta", "Alpha"]);
  });

  it("serializes CSV with escaped cells", () => {
    expect(tableRowsToCsv(["Name", "Note"], [["Acme, Inc.", "He said \"ok\""], ["Blank", null]])).toBe(
      'Name,Note\r\n"Acme, Inc.","He said ""ok"""\r\nBlank,'
    );
  });

  it("paginates rows at 20 rows per page by default table size", () => {
    const rows = Array.from({ length: 45 }, (_, index) => index + 1);

    expect(paginateRows(rows, 1, 20)).toEqual(rows.slice(0, 20));
    expect(paginateRows(rows, 2, 20)).toEqual(rows.slice(20, 40));
    expect(totalPagesForRows(rows.length, 20)).toBe(3);
  });
});
