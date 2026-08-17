import { z } from "zod";

export type CsvDelimiter = "," | ";";

export type ParsedMaterialsCsvRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type ParsedMaterialsCsv = {
  delimiter: CsvDelimiter;
  headers: string[];
  rows: ParsedMaterialsCsvRow[];
  inputRowCount: number;
};

export type NormalizedMaterialsCsvRow = {
  rowNumber: number;
  sku: string;
  name: string;
  uom: string;
  min_stock: number;
};

export type MaterialsCsvValidationIssue = {
  row: number;
  field: string;
  message: string;
};

export class MaterialsCsvValidationError extends Error {
  issues: MaterialsCsvValidationIssue[];

  constructor(issues: MaterialsCsvValidationIssue[]) {
    super("CSV validation failed.");
    this.issues = issues;
  }
}

export class MaterialsCsvRowLimitError extends Error {
  rowNumber: number;
  limit: number;

  constructor(rowNumber: number, limit: number) {
    super(`CSV exceeds the maximum of ${limit} data rows.`);
    this.rowNumber = rowNumber;
    this.limit = limit;
  }
}

export const MAX_MATERIALS_CSV_ROWS = 25_000;

const csvRowSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required.").max(80, "SKU must be 80 characters or fewer."),
  name: z.string().trim().min(1, "Name is required.").max(160, "Name must be 160 characters or fewer."),
  uom: z.preprocess((value) => {
    if (typeof value === "string" && value.trim() === "") return "unit";
    return value;
  }, z.string().trim().min(1).max(30).default("unit")),
  min_stock: z.preprocess((value) => {
    if (value === undefined || value === null) return 0;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") return 0;
      return Number(trimmed);
    }
    return value;
  }, z.number({ invalid_type_error: "Minimum stock must be a valid non-negative number." }).finite("Minimum stock must be a valid non-negative number.").min(0, "Minimum stock must be a valid non-negative number."))
}).strict();

function normalizeCsvInput(input: string) {
  return input.startsWith("\ufeff") ? input.slice(1) : input;
}

function normalizeNewlines(input: string) {
  return normalizeCsvInput(input).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function detectDelimiter(headerLine: string): CsvDelimiter {
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;

  for (let index = 0; index < headerLine.length; index += 1) {
    const char = headerLine[index];
    if (char === '"') {
      if (inQuotes && headerLine[index + 1] === '"') {
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes) {
      if (char === ",") commas += 1;
      if (char === ";") semicolons += 1;
    }
  }

  return semicolons > commas ? ";" : ",";
}

function splitRecords(text: string, delimiter: CsvDelimiter, maxDataRows: number) {
  const rows: Array<{ rowNumber: number; fields: string[] }> = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let quotedFieldClosed = false;
  let rowNumber = 1;
  let rowStartNumber = 1;

  const pushRow = () => {
    const recordFields = [...fields, field];
    const isBlankRow = recordFields.length === 1 && recordFields[0].trim() === "";
    if (!isBlankRow) {
      if (rows.length >= maxDataRows + 1) {
        throw new MaterialsCsvRowLimitError(rowStartNumber, maxDataRows);
      }
      rows.push({ rowNumber: rowStartNumber, fields: recordFields });
    }
    fields = [];
    field = "";
    rowStartNumber = rowNumber + 1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          quotedFieldClosed = true;
        }
      } else {
        field += char;
      }
      if (char === "\n") {
        rowNumber += 1;
      }
      continue;
    }

    if (char === delimiter) {
      quotedFieldClosed = false;
      fields.push(field);
      field = "";
      continue;
    }

    if (char === '"') {
      if (field.trim() === "") {
        field = "";
        inQuotes = true;
        continue;
      }
      throw new MaterialsCsvValidationError([
        { row: rowNumber, field: "row", message: "Quote characters must wrap an entire field." }
      ]);
    }

    if (char === "\n") {
      quotedFieldClosed = false;
      pushRow();
      rowNumber += 1;
      continue;
    }

    if (quotedFieldClosed && !/\s/.test(char)) {
      throw new MaterialsCsvValidationError([
        { row: rowNumber, field: "row", message: "Unexpected content after a quoted field." }
      ]);
    }

    field += char;
  }

  if (inQuotes) {
    throw new MaterialsCsvValidationError([
      { row: rowStartNumber, field: "row", message: "Unterminated quoted field." }
    ]);
  }

  const hasTrailingContent = field.length > 0 || fields.length > 0;
  if (hasTrailingContent) {
    pushRow();
  }

  return rows;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function getField(row: Record<string, string>, field: string) {
  return row[field] ?? "";
}

export function parseMaterialsCsv(input: string, options: { maxRows?: number | null } = {}): ParsedMaterialsCsv {
  const text = normalizeNewlines(input);
  const firstContentLine = text.split("\n").find((line) => line.trim().length > 0) ?? "";
  const delimiter = detectDelimiter(firstContentLine);
  const maxDataRows = Math.min(options.maxRows ?? MAX_MATERIALS_CSV_ROWS, MAX_MATERIALS_CSV_ROWS);
  const records = splitRecords(text, delimiter, maxDataRows);

  if (records.length === 0) {
    return { delimiter, headers: [], rows: [], inputRowCount: 0 };
  }

  const [header, ...dataRows] = records;
  const headers = header.fields.map(normalizeHeader);
  const duplicateHeaders = [...new Set(headers.filter((headerName, index) => headerName.length > 0 && headers.indexOf(headerName) !== index))];
  if (duplicateHeaders.length > 0) {
    throw new MaterialsCsvValidationError(
      duplicateHeaders.map((headerName) => ({
        row: header.rowNumber,
        field: headerName,
        message: `Duplicate CSV header "${headerName}".`
      }))
    );
  }
  const rows = dataRows.map((record) => {
    const values = headers.reduce<Record<string, string>>((acc, headerName, index) => {
      acc[headerName] = record.fields[index] ?? "";
      return acc;
    }, {});
    return { rowNumber: record.rowNumber, values };
  });

  return { delimiter, headers, rows, inputRowCount: dataRows.length };
}

export function normalizeMaterialsCsvImport(input: string, options: { maxRows?: number | null } = {}) {
  const parsed = parseMaterialsCsv(input, options);
  const skuIndex = parsed.headers.indexOf("sku");
  const nameIndex = parsed.headers.indexOf("name");
  const uomIndex = parsed.headers.indexOf("uom");
  const minStockIndex = parsed.headers.indexOf("min_stock");

  const issues: MaterialsCsvValidationIssue[] = [];
  if (skuIndex < 0 || nameIndex < 0) {
    issues.push({ row: 1, field: "sku", message: "CSV requires sku and name columns." });
    issues.push({ row: 1, field: "name", message: "CSV requires sku and name columns." });
    throw new MaterialsCsvValidationError(issues);
  }

  const materialRows: NormalizedMaterialsCsvRow[] = [];
  for (const row of parsed.rows) {
    const candidate = {
      sku: getField(row.values, parsed.headers[skuIndex]),
      name: getField(row.values, parsed.headers[nameIndex]),
      uom: uomIndex >= 0 ? getField(row.values, parsed.headers[uomIndex]) : "unit",
      min_stock: minStockIndex >= 0 ? getField(row.values, parsed.headers[minStockIndex]) : ""
    };

    const normalized = csvRowSchema.safeParse(candidate);
    if (!normalized.success) {
      for (const issue of normalized.error.issues) {
        issues.push({
          row: row.rowNumber,
          field: issue.path[0]?.toString() ?? "row",
          message: issue.message
        });
      }
      continue;
    }

    materialRows.push({
      rowNumber: row.rowNumber,
      sku: normalized.data.sku,
      name: normalized.data.name,
      uom: normalized.data.uom,
      min_stock: normalized.data.min_stock
    });
  }

  if (issues.length > 0) {
    throw new MaterialsCsvValidationError(issues);
  }

  const deduped = new Map<string, NormalizedMaterialsCsvRow>();
  const duplicateSkus = new Set<string>();
  for (const row of materialRows) {
    if (deduped.has(row.sku)) {
      duplicateSkus.add(row.sku);
    }
    deduped.set(row.sku, row);
  }

  return {
    delimiter: parsed.delimiter,
    headers: parsed.headers,
    inputRowCount: parsed.inputRowCount,
    rows: [...deduped.values()],
    duplicateSkus: [...duplicateSkus]
  };
}
