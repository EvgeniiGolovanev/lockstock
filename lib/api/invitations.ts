import { createHash, randomBytes } from "node:crypto";

export function generateInvitationToken(): string {
  return randomBytes(24).toString("hex");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
