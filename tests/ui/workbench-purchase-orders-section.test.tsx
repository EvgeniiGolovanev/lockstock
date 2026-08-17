import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ locale: "en", setLocale: vi.fn() })
}));

import { WorkbenchPurchaseOrdersSection } from "@/components/workbench/purchase-orders-section";

describe("WorkbenchPurchaseOrdersSection", () => {
  it("renders the purchase order filters, table, and detail actions", () => {
    const onOpenCreatePurchaseOrderForm = vi.fn();
    const onOpenReceivePurchaseOrderForm = vi.fn();
    const onPrepareReceivePurchaseOrder = vi.fn();
    const onSelectedPoDetailsIdChange = vi.fn();
    const onPendingCancelPoChange = vi.fn();

    render(
      <WorkbenchPurchaseOrdersSection
        busy={false}
        canManageCatalog={true}
        canReceivePurchaseOrders={true}
        canExportCsv={true}
        apiRequest={vi.fn()}
        onActivity={vi.fn()}
        onBusyChange={vi.fn()}
        onRefreshCoreData={vi.fn().mockResolvedValue(undefined)}
        poTotal={1}
        poPage={1}
        poTotalPages={2}
        poOverview={{
          totalOrders: 1,
          openOrders: 1,
          receivedOrders: 0,
          totalValue: 123.45,
          totalValueByCurrency: { EUR: 123.45, USD: 0 },
          statusCounts: { draft: 1, sent: 0, partial: 0, received: 0, cancelled: 0 }
        }}
        poFilterQuery=""
        poFilterStatus="all"
        poFilterSupplierId="all"
        suppliers={[{ id: "sup-1", name: "Acme Supplies" }]}
        purchaseOrderTableRows={[
          {
            po: {
              id: "po-1",
              po_number: "PO-1001",
              status: "draft",
              currency: "EUR",
              created_at: "2026-08-01",
              expected_at: "2026-08-10",
              sent_at: null,
              received_at: null,
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
            },
            summary: {
              supplierLabel: "Acme Supplies",
              lineCount: 1,
              linePreview: "Portland Cement",
              totalOrdered: 10,
              totalReceived: 2,
              progressPercentage: 20,
              totalAmount: 45,
              currency: "EUR"
            }
          }
        ]}
        selectedPoDetails={{
          id: "po-1",
          po_number: "PO-1001",
          status: "draft",
          currency: "EUR",
          created_at: "2026-08-01",
          expected_at: "2026-08-10",
          sent_at: null,
          received_at: null,
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
        }}
        pendingCancelPo={{
          id: "po-2",
          po_number: "PO-1002",
          status: "sent",
          currency: "EUR",
          created_at: "2026-08-02",
          expected_at: null,
          sent_at: "2026-08-03",
          received_at: null,
          supplier: { id: "sup-1", name: "Acme Supplies" },
          lines: []
        }}
        materials={[
          {
            id: "mat-1",
            sku: "MAT-001",
            name: "Portland Cement",
            uom: "BAG"
          }
        ]}
        tableSortState={{ key: "poNumber", direction: "asc" }}
        onOpenCreatePurchaseOrderForm={onOpenCreatePurchaseOrderForm}
        onOpenReceivePurchaseOrderForm={onOpenReceivePurchaseOrderForm}
        onPrepareReceivePurchaseOrder={onPrepareReceivePurchaseOrder}
        onSelectedPoDetailsIdChange={onSelectedPoDetailsIdChange}
        onPendingCancelPoChange={onPendingCancelPoChange}
        onPoFilterQueryChange={vi.fn()}
        onPoFilterStatusChange={vi.fn()}
        onPoFilterSupplierIdChange={vi.fn()}
        onPoPageChange={vi.fn()}
        onExportCsv={vi.fn()}
        onSort={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Purchase Orders Status" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All Purchase Orders" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create PO" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Receive order" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Supplier" })).toBeInTheDocument();
    expect(screen.getByText("Page 1/2")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Purchase order PO-1001" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Confirm purchase order cancellation" })).toBeInTheDocument();
  });
});
