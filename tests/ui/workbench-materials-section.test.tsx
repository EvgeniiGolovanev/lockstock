import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ locale: "en", setLocale: vi.fn() })
}));

import { WorkbenchMaterialsSection } from "@/components/workbench/materials-section";

describe("WorkbenchMaterialsSection", () => {
  it("renders the materials filters, table, and management actions", () => {
    const onCreateMaterial = vi.fn();
    const onEditMaterial = vi.fn();
    const onToggleMaterialUsage = vi.fn();

    const { container } = render(
      <WorkbenchMaterialsSection
        busy={false}
        canExportCsv={true}
        canManageCatalog={true}
        isOrgScopedReady={true}
        materialPage={1}
        materialTotalPages={3}
        materialTableRows={[
          {
            id: "mat-1",
            sku: "MAT-001",
            name: "Portland Cement",
            category: "Structural & Building Materials",
            subcategory: "Concrete & cement",
            description: "For foundations",
            uom: "BAG",
            minStock: 10,
            status: "In Stock",
            createdAt: "2026-08-01",
            material: {
              id: "mat-1",
              sku: "MAT-001",
              name: "Portland Cement",
              description: "For foundations",
              uom: "BAG",
              category: "Structural & Building Materials",
              subcategory: "Concrete & cement",
              created_at: "2026-08-01",
              min_stock: 10,
              is_active: true,
              total_quantity: 25,
              primary_location: "Main Warehouse",
              stock_status: "in-stock",
              balances: []
            }
          }
        ]}
        materialSearchQuery=""
        materialCategoryFilter="all"
        materialSubcategoryFilter="all"
        materialCategoryOptions={["Structural & Building Materials", "Electrical"]}
        materialFilterSubcategories={["all", "Concrete & cement"]}
        onCreateMaterial={onCreateMaterial}
        onEditMaterial={onEditMaterial}
        onToggleMaterialUsage={onToggleMaterialUsage}
        onExportCsv={vi.fn()}
        onMaterialSearchChange={vi.fn()}
        onMaterialCategoryFilterChange={vi.fn()}
        onMaterialSubcategoryFilterChange={vi.fn()}
        onMaterialPageChange={vi.fn()}
        onSort={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Materials" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Material" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Block" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Category filter" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Subcategory filter" })).toBeInTheDocument();
    expect(screen.getByText("Page 1/3")).toBeInTheDocument();
    expect(container.querySelectorAll(".field-icon")).toHaveLength(3);
  });
});
