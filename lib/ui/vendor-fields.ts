export type PhoneCountryCodeOption = {
  value: string;
  label: string;
};

export const PHONE_COUNTRY_CODES: PhoneCountryCodeOption[] = [
  { value: "+33", label: "France (+33)" },
  { value: "+1", label: "United States (+1)" },
  { value: "+44", label: "United Kingdom (+44)" },
  { value: "+49", label: "Germany (+49)" },
  { value: "+34", label: "Spain (+34)" },
  { value: "+39", label: "Italy (+39)" },
  { value: "+31", label: "Netherlands (+31)" },
  { value: "+32", label: "Belgium (+32)" },
  { value: "+41", label: "Switzerland (+41)" },
  { value: "+351", label: "Portugal (+351)" },
  { value: "+48", label: "Poland (+48)" },
  { value: "+420", label: "Czech Republic (+420)" },
  { value: "+421", label: "Slovakia (+421)" },
  { value: "+40", label: "Romania (+40)" },
  { value: "+90", label: "Turkey (+90)" }
];

export const DEFAULT_PHONE_COUNTRY_CODE = PHONE_COUNTRY_CODES[0]?.value ?? "+33";

export function formatVendorNumber(value?: number | null): string {
  if (!Number.isInteger(value) || (value ?? 0) <= 0) {
    return "";
  }

  return String(value).padStart(8, "0");
}

export function splitPhoneNumber(
  value?: string | null,
  fallbackCountryCode: string = DEFAULT_PHONE_COUNTRY_CODE
): {
  countryCode: string;
  localNumber: string;
} {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return {
      countryCode: fallbackCountryCode,
      localNumber: ""
    };
  }

  const normalized = trimmed.replace(/\s+/g, " ");
  const knownCode = PHONE_COUNTRY_CODES.map((option) => option.value)
    .sort((left, right) => right.length - left.length)
    .find((code) => normalized === code || normalized.startsWith(`${code} `));

  if (knownCode) {
    return {
      countryCode: knownCode,
      localNumber: normalized.slice(knownCode.length).trim()
    };
  }

  const genericMatch = normalized.match(/^(\+\d{1,4})(.*)$/);
  if (genericMatch) {
    return {
      countryCode: genericMatch[1],
      localNumber: genericMatch[2].trim()
    };
  }

  return {
    countryCode: fallbackCountryCode,
    localNumber: normalized
  };
}

export function buildPhoneNumber(countryCode: string, localNumber: string): string | undefined {
  const normalizedCountryCode = countryCode.trim();
  const normalizedLocalNumber = localNumber.trim();

  if (!normalizedLocalNumber) {
    return undefined;
  }

  return `${normalizedCountryCode} ${normalizedLocalNumber}`.trim();
}
