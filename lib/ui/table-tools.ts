export type SortDirection = "asc" | "desc";

export type SortState<Key extends string = string> = {
  key: Key;
  direction: SortDirection;
};

const alphaNumericCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base"
});

export type CsvCell = string | number | boolean | null | undefined;

export function compareAlphaNumeric(left: CsvCell, right: CsvCell) {
  return alphaNumericCollator.compare(String(left ?? ""), String(right ?? ""));
}

export function sortRowsByKey<Row, Key extends string>(
  rows: Row[],
  sort: SortState<Key> | undefined,
  getValue: (row: Row, key: Key) => CsvCell
) {
  if (!sort) {
    return rows;
  }

  return [...rows].sort((left, right) => {
    const result = compareAlphaNumeric(getValue(left, sort.key), getValue(right, sort.key));
    return sort.direction === "asc" ? result : -result;
  });
}

function escapeCsvCell(value: CsvCell) {
  const text = String(value ?? "");
  if (!/[",\r\n]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

export function tableRowsToCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[]) {
  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

export function totalPagesForRows(totalRows: number, pageSize: number) {
  return Math.max(1, Math.ceil(totalRows / pageSize));
}

export function paginateRows<Row>(rows: Row[], page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  return rows.slice(from, from + pageSize);
}
