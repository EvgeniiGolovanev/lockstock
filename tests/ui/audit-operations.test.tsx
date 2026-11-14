import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkbenchPurchaseOrderForms } from "@/components/workbench/purchase-order-forms";
import { WorkbenchStockMovementsSection } from "@/components/workbench/stock-movements-section";
import { expandInventoryRows, filterInventoryRows, inventoryMetrics } from "@/lib/ui/parity-models";

vi.mock("@/components/language-provider", () => ({ useLanguage: () => ({ locale: "en", setLocale: vi.fn() }) }));
afterEach(cleanup);

function receipt(overrides: Partial<ComponentProps<typeof WorkbenchPurchaseOrderForms>> = {}) {
  const props: ComponentProps<typeof WorkbenchPurchaseOrderForms> = {
    busy: false, isOrgScopedReady: true, canManageCatalog: true, canReceivePurchaseOrders: true,
    apiRequest: vi.fn().mockResolvedValue({}), onActivity: vi.fn(), onBusyChange: vi.fn(),
    onRefreshCoreData: vi.fn().mockResolvedValue(undefined), onRefreshRequiredChange: vi.fn(),
    showPoCreateForm: false, showPoReceiveForm: true, activeSuppliers: [],
    activeMaterials: [{ id: "cement", sku: "CEM", name: "Cement", uom: "bag" }],
    activeLocations: [{ id: "main", name: "Main" }],
    purchaseOrders: [{ id: "partial", po_number: "PO-1", status: "partial", supplier: null, lines: [
      { id: "done", material_id: "cement", quantity_ordered: 1, quantity_received: 1, unit_price: 1 },
      { id: "open", material_id: "cement", quantity_ordered: 2, quantity_received: 1.5, unit_price: 1 }
    ] }], initialReceivePoId: "partial", initialReceivePoLineId: "done",
    onClosePoCreateForm: vi.fn(), onClosePoReceiveForm: vi.fn(), ...overrides
  };
  return { props, ...render(<WorkbenchPurchaseOrderForms {...props} />) };
}

function movement(overrides: Partial<ComponentProps<typeof WorkbenchStockMovementsSection>> = {}) {
  const props: ComponentProps<typeof WorkbenchStockMovementsSection> = {
    busy: false, canCreateStockMovement: true, canExportCsv: false,
    apiRequest: vi.fn().mockResolvedValue({}), onActivity: vi.fn(), onBusyChange: vi.fn(),
    onRefreshCoreData: vi.fn().mockResolvedValue(undefined), movementPage: 1, movementTotalPages: 1,
    movementFilterQuery: "", movementLocationFilter: "all", movementReasonFilter: "all",
    movementLocations: ["all"], movementReasons: ["all"], movementTableRows: [], movementSortState: undefined,
    showMovementForm: true,
    activeMaterials: [{ id: "pipe", sku: "PIPE", name: "Pipe", uom: "M", balances: [
      { location_id: "main", quantity: 2.5, location: { code: "MAIN", name: "Main" } },
      { location_id: "site", quantity: 1, location: { code: "SITE", name: "Site" } }
    ] }], activeLocations: [{ id: "main", code: "MAIN", name: "Main" }, { id: "site", code: "SITE", name: "Site" }],
    onShowMovementFormChange: vi.fn(), onMovementFilterQueryChange: vi.fn(), onMovementLocationFilterChange: vi.fn(),
    onMovementReasonFilterChange: vi.fn(), onMovementPageChange: vi.fn(), onExportCsv: vi.fn(), onSort: vi.fn(), ...overrides
  };
  const view = render(<WorkbenchStockMovementsSection {...props} />);
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Material"), { target: { value: "pipe" } });
  fireEvent.change(dialog.getByLabelText("Location"), { target: { value: "main" } });
  return { props, dialog, ...view };
}

describe("audit: inventory and operation safeguards", () => {
  it("uses company stock status consistently across split balances, filters and metrics", () => {
    const materials = [{ id: "pipe", sku: "PIPE", name: "Pipe", uom: "M", min_stock: 10, total_quantity: 20,
      balances: [{ quantity: 1, location: { name: "Site" } }, { quantity: 19, location: { name: "Main" } }] }];
    const rows = expandInventoryRows(materials);
    expect(rows.every(row => row.stock_status === "in-stock")).toBe(true);
    expect(filterInventoryRows(rows, "", "low-stock", "all")).toHaveLength(0);
    expect(inventoryMetrics(materials, []).lowStock).toBe(0);
  });

  it("selects an outstanding receipt line instead of a completed requested line", () => {
    receipt();
    expect(screen.getByLabelText("Line")).toHaveValue("open");
    expect(within(screen.getByLabelText("Line")).queryByRole("option", { name: /ordered 1 \|/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Quantity Received/)).toHaveAttribute("max", "0.5");
  });

  it("blocks a receipt above the outstanding quantity and accepts a fractional receipt", () => {
    const { props } = receipt({ initialReceivePoLineId: "open" });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "main" } });
    fireEvent.change(screen.getByLabelText(/Quantity Received/), { target: { value: "0.6" } });
    expect(screen.getByRole("button", { name: "Receive" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Quantity Received/), { target: { value: "0.25" } });
    fireEvent.click(screen.getByRole("button", { name: "Receive" }));
    expect(props.apiRequest).toHaveBeenCalledWith("/api/purchase-orders/partial/receive", expect.objectContaining({ body: {
      receipts: [{ po_line_id: "open", location_id: "main", quantity_received: 0.25 }]
    } }));
  });

  it("excludes drafts and orders with no outstanding lines from receipt selection", () => {
    receipt({ initialReceivePoId: "", initialReceivePoLineId: "", purchaseOrders: [
      { id: "draft", po_number: "DRAFT", status: "draft", supplier: null, lines: [{ id: "x", material_id: "cement", quantity_ordered: 1, quantity_received: 0, unit_price: 1 }] },
      { id: "full", po_number: "FULL", status: "sent", supplier: null, lines: [{ id: "y", material_id: "cement", quantity_ordered: 1, quantity_received: 1, unit_price: 1 }] }
    ] });
    expect(within(screen.getByLabelText("Purchase Order")).getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Receive" })).toBeDisabled();
  });

  it("clears the old receipt line when switching to a different order", () => {
    const { props } = receipt({ initialReceivePoLineId: "open" });
    fireEvent.change(screen.getByLabelText("Purchase Order"), { target: { value: "" } });
    expect(screen.getByLabelText("Line")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Receive" })).toBeDisabled();
    expect(props.apiRequest).not.toHaveBeenCalled();
  });

  it("can receive the exact decimal remainder without floating-point rejection", () => {
    receipt({ initialReceivePoLineId: "decimal", purchaseOrders: [{ id: "partial", po_number: "PO-1", status: "partial", supplier: null,
      lines: [{ id: "decimal", material_id: "cement", quantity_ordered: 0.3, quantity_received: 0.1, unit_price: 1 }] }] });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "main" } });
    fireEvent.change(screen.getByLabelText("Quantity Received"), { target: { value: "0.2" } });
    expect(screen.getByLabelText("Quantity Received")).toHaveAttribute("max", "0.2");
    expect(screen.getByRole("button", { name: "Receive" })).toBeEnabled();
    expect(screen.getByText("Remaining to receive: 0.2 bag.")).toBeInTheDocument();
  });

  it("requires deliberate material and location selection before a movement", () => {
    const { dialog } = movement();
    fireEvent.change(dialog.getByLabelText("Material"), { target: { value: "" } });
    expect(dialog.getByRole("button", { name: "Add to Stock" })).toBeDisabled();
  });

  it("accepts positive fractional consumption and shows its effect on stock", () => {
    const { props, dialog } = movement();
    fireEvent.change(dialog.getByLabelText("Reason"), { target: { value: "consumption" } });
    fireEvent.change(dialog.getByLabelText("Quantity"), { target: { value: "0.5" } });
    expect(dialog.getByLabelText("Quantity")).toHaveAttribute("min", "0.001");
    expect(dialog.getByLabelText("Quantity")).not.toHaveAttribute("max", "-1");
    expect(dialog.getByRole("status")).toHaveTextContent("2.5 → 2 M");
    fireEvent.click(dialog.getByRole("button", { name: "Record Consumption" }));
    expect(props.apiRequest).toHaveBeenCalledWith("/api/stock/movements", expect.objectContaining({ body: expect.objectContaining({ quantity_delta: -0.5 }) }));
  });

  it("labels a transfer correctly and blocks moving more than the source holds", () => {
    const { dialog } = movement();
    fireEvent.change(dialog.getByLabelText("Reason"), { target: { value: "transfer" } });
    fireEvent.change(dialog.getByLabelText("Transfer out"), { target: { value: "main" } });
    fireEvent.change(dialog.getByLabelText("Transfer to"), { target: { value: "site" } });
    fireEvent.change(dialog.getByLabelText("Quantity"), { target: { value: "3" } });
    expect(dialog.getByRole("button", { name: "Transfer stock" })).toBeDisabled();
    fireEvent.change(dialog.getByLabelText("Quantity"), { target: { value: "0.5" } });
    expect(dialog.getByRole("button", { name: "Transfer stock" })).toBeEnabled();
    expect(dialog.getByRole("status")).toHaveTextContent("2.5 → 2 M");
    expect(dialog.getByRole("status")).toHaveTextContent("1 → 1.5 M");
  });

  it("keeps balances separate when two locations share a name and have no code", () => {
    const { dialog } = movement({
      activeMaterials: [{ id: "pipe", sku: "PIPE", name: "Pipe", uom: "M", balances: [
        { location_id: "main", quantity: 2, location: { name: "Storage" } },
        { location_id: "site", quantity: 20, location: { name: "Storage" } }
      ] }], activeLocations: [{ id: "main", name: "Storage" }, { id: "site", name: "Storage" }]
    });
    fireEvent.change(dialog.getByLabelText("Reason"), { target: { value: "consumption" } });
    fireEvent.change(dialog.getByLabelText("Quantity"), { target: { value: "3" } });
    expect(dialog.getByRole("button", { name: "Record Consumption" })).toBeDisabled();
    expect(dialog.getByRole("status")).toHaveTextContent("2 → -1 M");
  });
});
