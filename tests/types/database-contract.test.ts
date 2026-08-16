import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const databaseTypes = readFileSync(resolve(process.cwd(), "types/database.ts"), "utf8");

describe("checked-in Supabase database contract", () => {
  it("includes the billing tables and new atomic command RPCs", () => {
    expect(databaseTypes).toContain("organization_billing");
    expect(databaseTypes).toContain("stripe_webhook_events");
    expect(databaseTypes).toContain("create_purchase_order_with_lines");
    expect(databaseTypes).toContain("create_team_with_owner");
    expect(databaseTypes).toContain("remove_org_member_with_team_memberships");
  });
});
