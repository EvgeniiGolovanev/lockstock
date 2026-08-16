import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkbenchCatalogForms } from "@/components/workbench/catalog-forms";
import { MATERIAL_CATEGORIES, getMaterialSubcategories } from "@/lib/material-categories";

describe("WorkbenchCatalogForms", () => {
  it("creates a location from the local form state", async () => {
    const apiRequest = vi.fn().mockResolvedValue({ data: { id: "loc-2" } });
    const onActivity = vi.fn();
    const onBusyChange = vi.fn();
    const onRefreshCoreData = vi.fn().mockResolvedValue(undefined);
    const onCloseLocationForm = vi.fn();

    render(
      <WorkbenchCatalogForms
        busy={false}
        canManageCatalog={true}
        isOrgScopedReady={true}
        locale="en"
        apiRequest={apiRequest}
        onActivity={onActivity}
        onBusyChange={onBusyChange}
        onRefreshCoreData={onRefreshCoreData}
        showLocationForm={true}
        editingLocation={null}
        pendingLocationUsageChange={null}
        onCloseLocationForm={onCloseLocationForm}
        onClosePendingLocationUsageChange={vi.fn()}
        showMaterialCreateForm={false}
        editingMaterial={null}
        pendingMaterialUsageChange={null}
        onCloseMaterialCreateForm={vi.fn()}
        onCloseEditMaterialForm={vi.fn()}
        onClosePendingMaterialUsageChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Create Location" }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
    expect(apiRequest).toHaveBeenCalledWith("/api/locations", {
      method: "POST",
      body: {
        name: "Main Warehouse",
        code: "MAIN",
        address: ""
      }
    });
    expect(onActivity).toHaveBeenCalledWith("Location created.");
    expect(onCloseLocationForm).toHaveBeenCalledTimes(1);
    expect(onRefreshCoreData).toHaveBeenCalledTimes(1);
    expect(onBusyChange).toHaveBeenCalledWith(true);
    expect(onBusyChange).toHaveBeenCalledWith(false);
  });

  it("loads an existing material into the edit form and saves changes", async () => {
    const apiRequest = vi.fn().mockResolvedValue({ data: { id: "mat-1" } });
    const onActivity = vi.fn();
    const onBusyChange = vi.fn();
    const onRefreshCoreData = vi.fn().mockResolvedValue(undefined);
    const onCloseEditMaterialForm = vi.fn();
    const editCategory = MATERIAL_CATEGORIES[0];
    const editSubcategory = getMaterialSubcategories(editCategory)[0] ?? "";

    render(
      <WorkbenchCatalogForms
        busy={false}
        canManageCatalog={true}
        isOrgScopedReady={true}
        locale="en"
        apiRequest={apiRequest}
        onActivity={onActivity}
        onBusyChange={onBusyChange}
        onRefreshCoreData={onRefreshCoreData}
        showLocationForm={false}
        editingLocation={null}
        pendingLocationUsageChange={null}
        onCloseLocationForm={vi.fn()}
        onClosePendingLocationUsageChange={vi.fn()}
        showMaterialCreateForm={false}
        editingMaterial={{
          id: "mat-1",
          sku: "MAT-001",
          name: "Portland Cement",
          description: "For foundations",
          uom: "BAG",
          category: editCategory,
          subcategory: editSubcategory,
          created_at: "2026-08-01",
          min_stock: 10,
          is_active: true,
          total_quantity: 25,
          primary_location: "Main Warehouse",
          stock_status: "in-stock",
          balances: []
        }}
        pendingMaterialUsageChange={null}
        onCloseMaterialCreateForm={vi.fn()}
        onCloseEditMaterialForm={onCloseEditMaterialForm}
        onClosePendingMaterialUsageChange={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog", { name: "Edit material" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Portland Cement")).toBeInTheDocument();

    const editDialog = screen.getByRole("dialog", { name: "Edit material" });
    fireEvent.change(within(editDialog).getByDisplayValue("Portland Cement"), { target: { value: "Portland Cement 42" } });
    const nextCategory = MATERIAL_CATEGORIES[1];
    fireEvent.change(within(editDialog).getAllByRole("combobox")[0], { target: { value: nextCategory } });
    expect(within(editDialog).getByDisplayValue("Portland Cement 42")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
    expect(apiRequest).toHaveBeenCalledWith("/api/materials/mat-1", {
      method: "PATCH",
      body: {
        name: "Portland Cement 42",
        category: nextCategory,
        subcategory: getMaterialSubcategories(nextCategory)[0] ?? "",
        min_stock: 10,
        description: "For foundations"
      }
    });
    expect(onActivity).toHaveBeenCalledWith("Material updated.");
    expect(onCloseEditMaterialForm).toHaveBeenCalledTimes(1);
    expect(onRefreshCoreData).toHaveBeenCalledTimes(1);
    expect(onBusyChange).toHaveBeenCalledWith(true);
    expect(onBusyChange).toHaveBeenCalledWith(false);
  });
});
