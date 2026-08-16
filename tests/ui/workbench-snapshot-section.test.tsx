import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkbenchSnapshotSection } from "@/components/workbench/snapshot-section";

describe("WorkbenchSnapshotSection", () => {
  it("renders the dashboard metrics, filters, and inventory table", () => {
    render(
      <WorkbenchSnapshotSection
        busy={false}
        canManageCatalog={true}
        canCreateStockMovement={true}
        canExportCsv={true}
        metrics={{ totalMaterials: 12, lowStock: 2, outOfStock: 1 }}
        lowStockCount={null}
        stockHealth={{ low_stock: 2, out_of_stock: 1 }}
        inventoryValueBadge="€"
        inventoryValueLabel="€123.45"
        materialFilterQuery=""
        inventoryStatus="all"
        inventoryLocation="all"
        inventoryLocations={["all", "Main Warehouse"]}
        inventoryTableRows={[
          {
            id: "row-1",
            sku: "MAT-001",
            name: "Cement",
            category: "Structural",
            subcategory: "Concrete",
            quantity: "5",
            uom: "BAG",
            pricePerUnit: "€4.00",
            total: "€20.00",
            location: "Main Warehouse",
            status: "in-stock",
            statusLabel: "In Stock",
            pricePerUnitExport: "4",
            totalExport: "20"
          }
        ]}
        materialPage={1}
        materialTotalPages={2}
        inventorySortState={{ key: "sku", direction: "asc" }}
        onMaterialFilterQueryChange={vi.fn()}
        onInventoryStatusChange={vi.fn()}
        onInventoryLocationChange={vi.fn()}
        onMaterialPageChange={vi.fn()}
        onExportCsv={vi.fn()}
        onSort={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Inventory status" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create Material" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Move Material" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Order Material" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Inventory status" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Location" })).toBeInTheDocument();
    expect(screen.getByText("Page 1/2")).toBeInTheDocument();
  });
});
