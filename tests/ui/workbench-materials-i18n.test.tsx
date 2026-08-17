// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ locale: "fr", setLocale: vi.fn() })
}));

import { WorkbenchMaterialsSection } from "@/components/workbench/materials-section";

describe("WorkbenchMaterialsSection localization", () => {
  it("renders French controls and row status from stable keys", () => {
    render(
      <WorkbenchMaterialsSection
        busy={false}
        canExportCsv
        canManageCatalog
        isOrgScopedReady
        materialPage={1}
        materialTotalPages={1}
        materialSearchQuery=""
        materialCategoryFilter="all"
        materialSubcategoryFilter="all"
        materialCategoryOptions={[]}
        materialFilterSubcategories={[]}
        materialTableRows={[{
          id: "mat-1", sku: "MAT-1", name: "Cement", category: "Concrete", subcategory: "Cement", description: "", uom: "EA", minStock: 2, status: "Blocked", createdAt: "today",
          material: { id: "mat-1", sku: "MAT-1", name: "Cement", uom: "EA", min_stock: 2, is_active: false }
        }]}
        onCreateMaterial={vi.fn()}
        onEditMaterial={vi.fn()}
        onToggleMaterialUsage={vi.fn()}
        onExportCsv={vi.fn()}
        onMaterialSearchChange={vi.fn()}
        onMaterialCategoryFilterChange={vi.fn()}
        onMaterialSubcategoryFilterChange={vi.fn()}
        onMaterialPageChange={vi.fn()}
        onSort={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Materiaux" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Creer un materiau" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtre de categorie" })).toBeInTheDocument();
    expect(screen.getByText("Bloque")).toBeInTheDocument();
  });
});
