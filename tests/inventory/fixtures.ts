import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";
import type { Database } from "../../types/database";

export type Material = { id: string; sku: string; uom: string };
export type Location = { id: string; name: string };
export type Supplier = { id: string; name: string };
export type PurchaseOrder = {
  id: string; po_number: string; status: string; supplier_id: string;
  lines: Array<{ id: string; material_id: string; quantity_ordered: number; quantity_received: number }>;
};

export const materialInput = (sku: string, uom = "PC") => ({
  sku, name: `Test ${sku}`, uom,
  category: "Structural & Building Materials", subcategory: "Concrete & cement", min_stock: 5
});

export class InventoryFixture {
  constructor(
    readonly request: APIRequestContext,
    readonly db: SupabaseClient,
    readonly orgId: string,
    readonly email: string,
    readonly password: string,
    readonly token: string,
    readonly userId: string
  ) {}

  headers(orgId = this.orgId, token = this.token) {
    return { authorization: `Bearer ${token}`, "x-org-id": orgId };
  }

  async post<T>(path: string, data: unknown, status = 201): Promise<T> {
    const response = await this.request.post(`/api${path}`, { headers: this.headers(), data });
    expect(response.status(), await response.text()).toBe(status);
    return (await response.json()).data as T;
  }

  async rows<T extends keyof Database["public"]["Tables"]>(table: T) {
    const { data, error } = await this.db.from(table).select("*").eq("org_id", this.orgId).order("id")
      .returns<Database["public"]["Tables"][T]["Row"][]>();
    expect(error).toBeNull();
    return data ?? [];
  }

  async snapshot() {
    // Full rows catch partial writes to balances, the movement ledger, PO lines,
    // header status/timestamps, and the audit log when a command fails.
    const tables = ["inventory_balances", "stock_movements", "purchase_orders", "po_lines", "audit_log", "materials", "locations", "suppliers"] as const;
    return Object.fromEntries(await Promise.all(tables.map(async (table) => [table, await this.rows(table)])));
  }

  async balances(expected: Array<[string, string, number]>) {
    const rows = await this.rows("inventory_balances");
    const sort = (values: Array<[string, string, number]>) => values.sort((a, b) => `${a[0]}:${a[1]}`.localeCompare(`${b[0]}:${b[1]}`));
    expect(sort(rows.map((row) => [row.material_id, row.location_id, Number(row.quantity)]))).toEqual(sort([...expected]));
    const ledger = await this.rows("stock_movements");
    for (const [material, location, quantity] of expected) {
      const sum = ledger.filter((row) => row.material_id === material && row.location_id === location)
        .reduce((total, row) => total + Number(row.quantity_delta), 0);
      expect(sum).toBeCloseTo(quantity, 3);
    }
  }

  async catalog() {
    const materials = [await this.post<Material>("/materials", materialInput("MAT-PC")),
      await this.post<Material>("/materials", materialInput("MAT-KG", "KG"))];
    const locations = [await this.post<Location>("/locations", { name: "Warehouse A", code: "A" }),
      await this.post<Location>("/locations", { name: "Warehouse B", code: "B" })];
    const suppliers = [await this.post<Supplier>("/suppliers", { name: "Vendor A" }),
      await this.post<Supplier>("/suppliers", { name: "Vendor B" })];
    return { materials, locations, suppliers };
  }

  async po(id: string): Promise<PurchaseOrder> {
    const { data, error } = await this.db.from("purchase_orders")
      .select("*,lines:po_lines(*)").eq("org_id", this.orgId).eq("id", id).single();
    expect(error).toBeNull();
    return data as PurchaseOrder;
  }

  async createPo(supplier: Supplier, lines: Array<{ material_id: string; quantity_ordered: number }>) {
    const created = await this.post<{ id: string }>("/purchase-orders", {
      supplier_id: supplier.id, currency: "EUR", po_number: `TEST-${randomUUID()}`, lines
    });
    return this.po(created.id);
  }

  async status(po: PurchaseOrder, status: "sent" | "cancelled") {
    const response = await this.request.patch(`/api/purchase-orders/${po.id}/status`, {
      headers: this.headers(), data: { status }
    });
    expect(response.status(), await response.text()).toBe(200);
  }

  async login(page: Page) {
    await page.addInitScript(({ orgId }) => {
      localStorage.setItem("lockstock.locale", "en");
      localStorage.setItem("lockstock.orgId", orgId);
    }, { orgId: this.orgId });
    await page.goto("/");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Welcome back" });
    await dialog.locator('input[type="email"]').fill(this.email);
    await dialog.locator('input[type="password"]').fill(this.password);
    await dialog.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/\/inventory/);
  }
}

export const test = base.extend<{ inventory: InventoryFixture }>({
  inventory: async ({ request }, provide) => {
    const url = process.env.INVENTORY_SUPABASE_URL!;
    if (!url || new URL(url).hostname !== "127.0.0.1" || !process.env.INVENTORY_DISPOSABLE_PROJECT?.startsWith("lockstock-db-verification-")) {
      throw new Error("Run npm run test:inventory to provision an isolated local test database.");
    }
    const db = createClient(url, process.env.INVENTORY_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const auth = createClient(url, process.env.INVENTORY_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const email = `inventory-${randomUUID()}@example.test`;
    const password = `Test-${randomUUID()}!`;
    const { data: user, error: userError } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    expect(userError).toBeNull();
    const { data: session, error: authError } = await auth.auth.signInWithPassword({ email, password });
    expect(authError).toBeNull();
    const token = session.session!.access_token;
    const response = await request.post("/api/organizations", {
      headers: { authorization: `Bearer ${token}` }, data: { name: `Inventory ${randomUUID()}`, plan: "business" }
    });
    expect(response.status(), await response.text()).toBe(201);
    const org = (await response.json()).data;
    // Every test gets a fresh user/workspace. The runner destroys the whole
    // disposable stack even on failure, including rows created during setup.
    await provide(new InventoryFixture(request, db, org.id, email, password, token, user.user!.id));
  }
});

export { expect };
