// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ locale: "fr", setLocale: vi.fn() })
}));

import { WorkbenchLocationsSection } from "@/components/workbench/locations-section";

describe("WorkbenchLocationsSection localization", () => {
  it("renders controls, table labels, and status at render time in French", () => {
    render(
      <WorkbenchLocationsSection
        busy={false}
        canExportCsv
        canManageCatalog
        hasLocations
        locationPage={1}
        locationTotalPages={1}
        locationSearchQuery=""
        locationStatusFilter="all"
        locationTableRows={[{
          id: "loc-1", code: "MAIN", name: "Main Warehouse", address: "Paris", status: "Active", lowStock: 0, outOfStock: 0,
          location: { id: "loc-1", code: "MAIN", name: "Main Warehouse", is_active: true }
        }]}
        onCreateLocation={vi.fn()}
        onEditLocation={vi.fn()}
        onToggleLocationUsage={vi.fn()}
        onExportCsv={vi.fn()}
        onLocationSearchChange={vi.fn()}
        onLocationStatusFilterChange={vi.fn()}
        onLocationPageChange={vi.fn()}
        onSort={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Gestion des emplacements" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter un emplacement" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtre de statut" })).toBeInTheDocument();
    expect(screen.getAllByText("Actif")).toHaveLength(2);
  });
});
