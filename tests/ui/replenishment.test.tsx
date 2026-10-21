import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReplenishmentScreen } from "@/components/replenishment/replenishment-screen";
import type { ReplenishmentRow } from "@/lib/replenishment/contracts";
const supplierId = "11111111-1111-4111-8111-111111111111";
const row: ReplenishmentRow = { material_id: "22222222-2222-4222-8222-222222222222", sku: "BOLT", name: "Bolts", uom: "PC", min_stock: "10.000", target_stock: "50.000", on_hand: "8.000", confirmed_incoming: "30.000", draft_planned: "0.000", suggested_order: "12.000", supplier_id: supplierId, currency: "EUR", unit_price: null, uncertain: false, state: "ready", snapshot_token: "snap", orders: [] };
describe("replenishment screen", () => {
  afterEach(cleanup);
  beforeEach(() => { localStorage.clear(); });
  function setup(rows = [row], manage = true, locale: "en" | "fr" = "en") {
    const api = vi.fn(async (path: string) => path.startsWith("/api/suppliers") ? { data: [{ id: supplierId, name: "Supplier", is_active: true }], meta: { total_pages: 1 } } : { data: { rows, total: rows.length, counts: { ready: rows.length } } });
    render(<ReplenishmentScreen orgId="org" accountKey="user" apiRequest={api as never} canManage={manage} locale={locale} />);
    return api;
  }
  it("shows quantities and requires review before mutation", async () => {
    const api = setup(); await screen.findByText("Bolts");
    fireEvent.click(screen.getByLabelText("Select BOLT"));
    fireEvent.click(screen.getByRole("button", { name: "Review draft orders" }));
    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(within(screen.getByRole("dialog")).getByText("Supplier")).toBeVisible();
    expect(screen.getByText("Price not set")).toBeVisible();
    expect(api.mock.calls.every(([path]) => !path.endsWith("/drafts"))).toBe(true);
  });
  it("does not offer creation to readers", async () => {
    setup([row], false); await screen.findByText("Bolts");
    expect(screen.getByRole("button", { name: "Review draft orders" })).toBeDisabled();
  });
  it("distinguishes empty from failed loading", async () => {
    setup([]); expect(await screen.findByText("No materials match this view.")).toBeVisible();
  });
  it("renders French labels", async () => {
    setup([row], true, "fr"); await screen.findByText("Bolts");
    expect(screen.getByRole("button", { name: "Vérifier les brouillons" })).toBeVisible();
  });
  it("requires acknowledgment for uncertain orders", async () => {
    setup([{ ...row, uncertain: true, state: "review" }]); await screen.findByText("Bolts");
    fireEvent.click(screen.getByLabelText("Select BOLT")); fireEvent.click(screen.getByRole("button", { name: "Review draft orders" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Create draft orders" })).toBeDisabled());
  });
  it("clears completed selections before the next batch", async () => {
    let created = false;
    const next = { ...row, material_id: "33333333-3333-4333-8333-333333333333", sku: "NEXT", name: "Next material" };
    const api = vi.fn(async (path: string) => {
      if (path.startsWith("/api/suppliers")) return { data: [{ id: supplierId, name: "Supplier", is_active: true }] };
      if (path.endsWith("/drafts")) { created=true; return { data: { request_id: "44444444-4444-4444-8444-444444444444", orders: [] } }; }
      return { data: { rows: [created ? { ...row, suggested_order: "0", state: "draft" } : row,next], total: 2, counts: {} } };
    });
    render(<ReplenishmentScreen orgId="org" accountKey="user" apiRequest={api as never} canManage locale="en" />);
    await screen.findByText("Bolts"); fireEvent.click(screen.getByLabelText("Select BOLT")); fireEvent.click(screen.getByText("Review draft orders")); fireEvent.click(screen.getByText("Create draft orders"));
    await screen.findByText("Draft orders created"); await screen.findByText("Next material");
    fireEvent.click(screen.getByLabelText("Select NEXT")); fireEvent.click(screen.getByText("Review draft orders"));
    expect(within(screen.getByRole("dialog")).queryByLabelText("Order quantity BOLT")).not.toBeInTheDocument();
  });
  it("retains safe price and quantity edits when refreshed after conflict", async () => {
    let conflict = false;
    const api = vi.fn(async (path: string) => {
      if (path.startsWith("/api/suppliers")) return { data: [{ id: supplierId, name: "Supplier", is_active: true }] };
      if (path.endsWith("/drafts")) { conflict=true; throw Object.assign(new Error("Recommendations changed"), { status: 409 }); }
      return { data: { rows: [{ ...row, snapshot_token: conflict ? "new" : "snap", suggested_order: conflict ? "13.000" : "12.000" }], total: 1, counts: {} } };
    });
    render(<ReplenishmentScreen orgId="org" accountKey="user" apiRequest={api as never} canManage locale="en" />);
    await screen.findByText("Bolts"); fireEvent.click(screen.getByLabelText("Select BOLT")); fireEvent.click(screen.getByText("Review draft orders"));
    fireEvent.change(screen.getByLabelText("Order quantity BOLT"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Unit price BOLT"), { target: { value: "2.50" } });
    fireEvent.click(screen.getByText("Create draft orders"));
    await screen.findByText("13.000"); fireEvent.click(screen.getByText("Review draft orders"));
    expect(screen.getByLabelText("Order quantity BOLT")).toHaveValue(5);
    expect(screen.getByLabelText("Unit price BOLT")).toHaveValue(2.5);
  });
});
