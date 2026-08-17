import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ locale: "fr", setLocale: vi.fn() })
}));

import { WorkbenchPurchaseOrdersSection } from "@/components/workbench/purchase-orders-section";

describe("WorkbenchPurchaseOrdersSection French messages", () => {
  it("renders translated filters, actions, and dialog labels before DOM insertion", () => {
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
        poTotalPages={1}
        poOverview={{ totalOrders: 1, openOrders: 1, receivedOrders: 0, totalValue: 45, totalValueByCurrency: { EUR: 45, USD: 0 }, statusCounts: { draft: 1, sent: 0, partial: 0, received: 0, cancelled: 0 } }}
        poFilterQuery=""
        poFilterStatus="all"
        poFilterSupplierId="all"
        suppliers={[{ id: "supplier-1", name: "Fournitures Acme" }]}
        purchaseOrderTableRows={[]}
        selectedPoDetails={null}
        pendingCancelPo={null}
        materials={[]}
        tableSortState={undefined}
        onOpenCreatePurchaseOrderForm={vi.fn()}
        onOpenReceivePurchaseOrderForm={vi.fn()}
        onPrepareReceivePurchaseOrder={vi.fn()}
        onSelectedPoDetailsIdChange={vi.fn()}
        onPendingCancelPoChange={vi.fn()}
        onPoFilterQueryChange={vi.fn()}
        onPoFilterStatusChange={vi.fn()}
        onPoFilterSupplierIdChange={vi.fn()}
        onPoPageChange={vi.fn()}
        onExportCsv={vi.fn()}
        onSort={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Etat des commandes d'achat" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Statut" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Fournisseur" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Creer une commande" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Receptionner la commande" })).toBeEnabled();
    expect(screen.getByText("Aucune commande d'achat ne correspond a ces filtres.")).toBeInTheDocument();
  });
});
