import { describe, expect, it } from "vitest";
import {
  MaterialsCsvValidationError,
  MaterialsCsvRowLimitError,
  normalizeMaterialsCsvImport,
  parseMaterialsCsv
} from "@/lib/import/materials-csv";

describe("materials CSV import", () => {
  it("parses Excel-style CSV with BOM, semicolons, quoted commas, and CRLF", () => {
    const parsed = parseMaterialsCsv(
      "\ufeffsku;name;uom;min_stock\r\nMAT-001;\"Stone, 20kg\";bag;5\r\nMAT-002;Nails;box;0\r\nMAT-003;\"Rebar\n8mm\";kg;0\r\n"
    );

    expect(parsed.delimiter).toBe(";");
    expect(parsed.headers).toEqual(["sku", "name", "uom", "min_stock"]);
    expect(parsed.rows).toEqual([
      { rowNumber: 2, values: { sku: "MAT-001", name: "Stone, 20kg", uom: "bag", min_stock: "5" } },
      { rowNumber: 3, values: { sku: "MAT-002", name: "Nails", uom: "box", min_stock: "0" } },
      { rowNumber: 4, values: { sku: "MAT-003", name: "Rebar\n8mm", uom: "kg", min_stock: "0" } }
    ]);
  });

  it("normalizes empty rows and validates every material row before import", () => {
    expect(() =>
      normalizeMaterialsCsvImport("sku,name,uom,min_stock\nMAT-001,,bag,abc\n\nMAT-002,Concrete,bag,-1\n")
    ).toThrowError(MaterialsCsvValidationError);

    try {
      normalizeMaterialsCsvImport("sku,name,uom,min_stock\nMAT-001,,bag,abc\n\nMAT-002,Concrete,bag,-1\n");
    } catch (error) {
      expect(error).toBeInstanceOf(MaterialsCsvValidationError);
      expect((error as MaterialsCsvValidationError).issues).toEqual([
        { row: 2, field: "name", message: "Name is required." },
        { row: 2, field: "min_stock", message: "Minimum stock must be a valid non-negative number." },
        { row: 4, field: "min_stock", message: "Minimum stock must be a valid non-negative number." }
      ]);
    }
  });

  it("uses inventory defaults for blank optional fields", () => {
    expect(normalizeMaterialsCsvImport("sku,name,uom,min_stock\nMAT-001,Concrete,,\n").rows).toEqual([
      { rowNumber: 2, sku: "MAT-001", name: "Concrete", uom: "unit", min_stock: 0 }
    ]);
  });

  it("counts duplicate input rows against the import limit before deduplication", () => {
    expect(() =>
      normalizeMaterialsCsvImport(
        "sku,name\nMAT-001,Concrete\nMAT-001,Concrete revised\nMAT-001,Concrete final\n",
        { maxRows: 2 }
      )
    ).toThrowError(MaterialsCsvRowLimitError);

    try {
      normalizeMaterialsCsvImport(
        "sku,name\nMAT-001,Concrete\nMAT-001,Concrete revised\nMAT-001,Concrete final\n",
        { maxRows: 2 }
      );
    } catch (error) {
      expect(error).toMatchObject({ rowNumber: 4, limit: 2 });
    }
  });

  it("enforces row limits at both terminal-newline boundaries", () => {
    expect(
      normalizeMaterialsCsvImport("sku,name\nMAT-001,Concrete\nMAT-002,Sand", { maxRows: 2 }).rows
    ).toHaveLength(2);
    expect(
      normalizeMaterialsCsvImport("sku,name\nMAT-001,Concrete\nMAT-002,Sand\n", { maxRows: 2 }).rows
    ).toHaveLength(2);
    expect(() =>
      normalizeMaterialsCsvImport("sku,name\nMAT-001,Concrete\nMAT-002,Sand\nMAT-003,Gravel", { maxRows: 2 })
    ).toThrowError(MaterialsCsvRowLimitError);
    expect(() =>
      normalizeMaterialsCsvImport("sku,name\nMAT-001,Concrete\nMAT-002,Sand\nMAT-003,Gravel\n", { maxRows: 2 })
    ).toThrowError(MaterialsCsvRowLimitError);
  });

  it("rejects duplicate normalized headers instead of selecting an arbitrary column", () => {
    expect(() => normalizeMaterialsCsvImport("sku,name, SKU\nMAT-001,Concrete,MAT-002\n")).toThrowError(
      MaterialsCsvValidationError
    );

    try {
      normalizeMaterialsCsvImport("sku,name, SKU\nMAT-001,Concrete,MAT-002\n");
    } catch (error) {
      expect((error as MaterialsCsvValidationError).issues).toEqual([
        { row: 1, field: "sku", message: 'Duplicate CSV header "sku".' }
      ]);
    }
  });

  it("rejects malformed quoted records with a row-numbered validation error", () => {
    expect(() => normalizeMaterialsCsvImport("sku,name\nMAT-001,\"Unclosed")).toThrowError(
      MaterialsCsvValidationError
    );

    try {
      normalizeMaterialsCsvImport("sku,name\nMAT-001,\"Unclosed");
    } catch (error) {
      expect((error as MaterialsCsvValidationError).issues).toEqual([
        { row: 2, field: "row", message: "Unterminated quoted field." }
      ]);
    }
  });

  it("rejects quote characters in unquoted fields", () => {
    expect(() => normalizeMaterialsCsvImport('sku,name\nMAT-001,Concrete "special"\n')).toThrowError(
      MaterialsCsvValidationError
    );

    try {
      normalizeMaterialsCsvImport('sku,name\nMAT-001,Concrete "special"\n');
    } catch (error) {
      expect((error as MaterialsCsvValidationError).issues).toEqual([
        { row: 2, field: "row", message: "Quote characters must wrap an entire field." }
      ]);
    }
  });
});
