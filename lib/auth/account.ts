export type AccountMetadataInput = {
  fullName: string;
  company: string;
  phone: string;
  jobTitle: string;
};

export type AccountMetadataPayload = {
  full_name: string | null;
  company: string | null;
  phone: string | null;
  job_title: string | null;
};

function toTrimmedOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function buildAccountMetadata(input: AccountMetadataInput): AccountMetadataPayload {
  return {
    full_name: toTrimmedOrNull(input.fullName),
    company: toTrimmedOrNull(input.company),
    phone: toTrimmedOrNull(input.phone),
    job_title: toTrimmedOrNull(input.jobTitle)
  };
}

export function metadataValue(metadata: Record<string, unknown> | null | undefined, key: string): string {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

export function validatePasswordChange(newPassword: string, confirmPassword: string): string | null {
  if (!newPassword.trim()) {
    return "New password is required.";
  }
  if (newPassword.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (newPassword !== confirmPassword) {
    return "Password confirmation does not match.";
  }
  return null;
}
