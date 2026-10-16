import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ locale: "en", setLocale: vi.fn() })
}));

import { WorkbenchStockMovementsSection } from "@/components/workbench/stock-movements-section";

describe("WorkbenchStockMovementsSection", () => {
  it("renders the movement filters, table, and form", async () => {
    const apiRequest = vi.fn().mockResolvedValue({ data: { id: "mov-2" } });
    const onShowMovementFormChange = vi.fn();
    const search = vi.fn(), locationFilter = vi.fn(), reasonFilter = vi.fn();

    render(
      <WorkbenchStockMovementsSection
        busy={false}
        canCreateStockMovement={true}
        canExportCsv={true}
        apiRequest={apiRequest}
        onActivity={vi.fn()}
        onBusyChange={vi.fn()}
        onRefreshCoreData={vi.fn().mockResolvedValue(undefined)}
        movementPage={1}
        movementTotalPages={3}
        movementFilterQuery=""
        movementLocationFilter="all"
        movementReasonFilter="all"
        movementLocations={["all", "Main Warehouse"]}
        movementReasons={["all", "adjustment"]}
        movementTableRows={[
          {
            id: "mov-1",
            createdAt: "2026-08-01 10:00",
            materialLabel: "MAT-001 - Cement",
            locationLabel: "Main Warehouse",
            quantity: "5",
            uom: "BAG",
            category: "Structural & Building Materials",
            reason: "Adjustment",
            comments: "Cycle count"
          }
        ]}
        movementSortState={{ key: "createdAt", direction: "asc" }}
        showMovementForm={true}
        activeMaterials={[{ id: "mat-1", sku: "MAT-001", name: "Cement" }]}
        activeLocations={[{ id: "loc-1", code: "WH1", name: "Main Warehouse" }]}
        onShowMovementFormChange={onShowMovementFormChange}
        onMovementFilterQueryChange={search}
        onMovementLocationFilterChange={locationFilter}
        onMovementReasonFilterChange={reasonFilter}
        onMovementPageChange={vi.fn()}
        onExportCsv={vi.fn()}
        onSort={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Material movements" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Material" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeEnabled();
    expect(screen.getByRole("dialog", { name: "Move Material" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to Stock" })).toBeEnabled();
    expect(screen.getByText("Page 1/3")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Search/), { target: { value: "Cement" } });
    expect(search).toHaveBeenCalledWith("Cement");
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "Main Warehouse" } });
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "adjustment" } });
    expect(locationFilter).toHaveBeenCalledWith("Main Warehouse");
    expect(reasonFilter).toHaveBeenCalledWith("adjustment");
    fireEvent.click(screen.getByRole("button", { name: "Move Material" }));
    expect(onShowMovementFormChange).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onShowMovementFormChange).toHaveBeenCalledWith(false);
    for (const button of screen.getAllByRole("button", { name: /Sort by/ })) fireEvent.click(button);

    fireEvent.click(screen.getByRole("button", { name: "Add to Stock" }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
    expect(apiRequest).toHaveBeenCalledWith("/api/stock/movements", {
      method: "POST",
      body: {
        material_id: "mat-1",
        location_id: "loc-1",
        quantity_delta: 1,
        reason: "adjustment",
        note: undefined
      }
    });
  });
});
