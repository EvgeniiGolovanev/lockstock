import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ locale: "en", setLocale: vi.fn() })
}));

import { WorkbenchPurchaseOrderForms } from "@/components/workbench/purchase-order-forms";

describe("WorkbenchPurchaseOrderForms", () => {
  it("submits a created purchase order from local draft state", async () => {
    const apiRequest = vi.fn().mockResolvedValue({ data: { id: "po-1" } });
    const onActivity = vi.fn();
    const onBusyChange = vi.fn();
    const onRefreshCoreData = vi.fn().mockResolvedValue(undefined);
    const onClosePoCreateForm = vi.fn();
    const onClosePoReceiveForm = vi.fn();

    render(
      <WorkbenchPurchaseOrderForms
        busy={false}
        isOrgScopedReady={true}
        canManageCatalog={true}
        canReceivePurchaseOrders={true}
        apiRequest={apiRequest}
        onActivity={onActivity}
        onBusyChange={onBusyChange}
        onRefreshCoreData={onRefreshCoreData}
        showPoCreateForm={true}
        showPoReceiveForm={false}
        activeSuppliers={[{ id: "sup-1", name: "Acme Supplies" }]}
        activeMaterials={[
          {
            id: "mat-1",
            sku: "MAT-001",
            name: "Portland Cement",
            uom: "BAG"
          }
        ]}
        purchaseOrders={[]}
        activeLocations={[{ id: "loc-1", code: "MAIN", name: "Main Warehouse" }]}
        initialReceivePoId=""
        initialReceivePoLineId=""
        onClosePoCreateForm={onClosePoCreateForm}
        onClosePoReceiveForm={onClosePoReceiveForm}
      />
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Supplier" }), { target: { value: "sup-1" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Material" }), { target: { value: "mat-1" } });
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText(/Unit Price/i), { target: { value: "4.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Item" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Purchase Order" }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
    expect(apiRequest).toHaveBeenCalledWith("/api/purchase-orders", {
      method: "POST",
      body: {
        supplier_id: "sup-1",
        currency: "EUR",
        expected_at: undefined,
        notes: undefined,
        lines: [
          {
            material_id: "mat-1",
            quantity_ordered: 12,
            unit_price: 4.5
          }
        ]
      }
    });
    expect(onClosePoCreateForm).toHaveBeenCalledTimes(1);
    expect(onRefreshCoreData).toHaveBeenCalledTimes(1);
    expect(onActivity).toHaveBeenCalledWith("Purchase order created.");
    expect(onBusyChange).toHaveBeenCalledWith(true);
    expect(onBusyChange).toHaveBeenCalledWith(false);
  });

  it("submits a purchase order receipt from local selection state", async () => {
    const apiRequest = vi.fn().mockResolvedValue({ data: { id: "receipt-1" } });
    const onActivity = vi.fn();
    const onBusyChange = vi.fn();
    const onRefreshCoreData = vi.fn().mockResolvedValue(undefined);
    const onClosePoCreateForm = vi.fn();
    const onClosePoReceiveForm = vi.fn();

    render(
      <WorkbenchPurchaseOrderForms
        busy={false}
        isOrgScopedReady={true}
        canManageCatalog={true}
        canReceivePurchaseOrders={true}
        apiRequest={apiRequest}
        onActivity={onActivity}
        onBusyChange={onBusyChange}
        onRefreshCoreData={onRefreshCoreData}
        showPoCreateForm={false}
        showPoReceiveForm={true}
        activeSuppliers={[]}
        activeMaterials={[
          {
            id: "mat-1",
            sku: "MAT-001",
            name: "Portland Cement",
            uom: "BAG"
          }
        ]}
        purchaseOrders={[
          {
            id: "po-1",
            po_number: "PO-1001",
            status: "sent",
            supplier: { id: "sup-1", name: "Acme Supplies" },
            lines: [
              {
                id: "line-1",
                material_id: "mat-1",
                quantity_ordered: 10,
                quantity_received: 2,
                unit_price: 4.5
              }
            ]
          }
        ]}
        activeLocations={[{ id: "loc-1", code: "MAIN", name: "Main Warehouse" }]}
        initialReceivePoId="po-1"
        initialReceivePoLineId="line-1"
        onClosePoCreateForm={onClosePoCreateForm}
        onClosePoReceiveForm={onClosePoReceiveForm}
      />
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Purchase Order" }), { target: { value: "po-1" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Line" }), { target: { value: "line-1" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Location" }), { target: { value: "loc-1" } });
    fireEvent.change(screen.getByLabelText("Quantity Received"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Receive" }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
    expect(apiRequest).toHaveBeenCalledWith("/api/purchase-orders/po-1/receive", {
      method: "POST",
      body: {
        receipts: [
          {
            po_line_id: "line-1",
            location_id: "loc-1",
            quantity_received: 3
          }
        ]
      }
    });
    expect(onClosePoReceiveForm).toHaveBeenCalledTimes(1);
    expect(onRefreshCoreData).toHaveBeenCalledTimes(1);
    expect(onActivity).toHaveBeenCalledWith("Purchase order receipt recorded.");
    expect(onBusyChange).toHaveBeenCalledWith(true);
    expect(onBusyChange).toHaveBeenCalledWith(false);
  });
});
