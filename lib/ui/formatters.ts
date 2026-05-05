const integerNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0
});

const decimalNumberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 20
});

export function formatNumberLabel(value: number, options?: Intl.NumberFormatOptions): string {
  const formatter = options
    ? new Intl.NumberFormat("en-US", options)
    : Number.isInteger(value)
      ? integerNumberFormatter
      : decimalNumberFormatter;

  return formatter.format(Number(value || 0)).replace(/,/g, " ");
}

function padDatePart(value: number): string {
  return value.toString().padStart(2, "0");
}

export function formatDateLabel(value?: string | Date | null): string {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return `${padDatePart(date.getDate())}/${padDatePart(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatDateTimeLabel(value?: string | Date | null): string {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return `${formatDateLabel(date)} ${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}:${padDatePart(
    date.getSeconds()
  )}`;
}
