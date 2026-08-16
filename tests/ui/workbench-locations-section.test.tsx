import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkbenchLocationsSection } from "@/components/workbench/locations-section";

describe("WorkbenchLocationsSection", () => {
  it("renders the location filters, table, and management actions", () => {
    const onCreateLocation = vi.fn();
    const onEditLocation = vi.fn();
    const onToggleLocationUsage = vi.fn();

    render(
      <WorkbenchLocationsSection
        busy={false}
        canExportCsv={true}
        canManageCatalog={true}
        locationPage={1}
        locationTotalPages={2}
        hasLocations={true}
        locationTableRows={[
          {
            id: "loc-1",
            code: "MAIN",
            name: "Main Warehouse",
            address: "221B Baker Street",
            status: "Active",
            lowStock: 2,
            outOfStock: 1,
            location: {
              id: "loc-1",
              code: "MAIN",
              name: "Main Warehouse",
              address: "221B Baker Street",
              is_active: true
            }
          }
        ]}
        locationSearchQuery=""
        locationStatusFilter="all"
        onCreateLocation={onCreateLocation}
        onEditLocation={onEditLocation}
        onToggleLocationUsage={onToggleLocationUsage}
        onExportCsv={vi.fn()}
        onLocationSearchChange={vi.fn()}
        onLocationStatusFilterChange={vi.fn()}
        onLocationPageChange={vi.fn()}
        onSort={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Location Management" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Location" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Block" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Status filter" })).toBeInTheDocument();
    expect(screen.getByText("Page 1/2")).toBeInTheDocument();
  });
});
