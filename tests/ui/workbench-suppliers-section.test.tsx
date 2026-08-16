import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkbenchSuppliersSection } from "@/components/workbench/suppliers-section";

describe("WorkbenchSuppliersSection", () => {
  it("renders the supplier filters, table, and management actions", () => {
    const onCreateSupplier = vi.fn();
    const onEditSupplier = vi.fn();
    const onToggleSupplierUsage = vi.fn();

    render(
      <WorkbenchSuppliersSection
        busy={false}
        canExportCsv={true}
        canManageCatalog={true}
        hasSuppliers={true}
        isOrgScopedReady={true}
        apiRequest={vi.fn()}
        onActivity={vi.fn()}
        onBusyChange={vi.fn()}
        onRefreshCoreData={vi.fn().mockResolvedValue(undefined)}
        supplierPage={1}
        supplierTotalPages={2}
        supplierTableRows={[
          {
            supplierId: "sup-1",
            vendorId: "00042",
            name: "Acme Supply",
            phone: "+33 1 23 45 67 89",
            address: "12 Rue Alpha",
            leadTimeDays: 7,
            status: "Active",
            openOrders: 2,
            receivedOrders: 4,
            totalOrders: 6,
            editableSupplier: {
              id: "sup-1",
              vendor_number: 42,
              name: "Acme Supply",
              phone: "+33 1 23 45 67 89",
              address: "12 Rue Alpha",
              lead_time_days: 7,
              is_active: true,
              created_at: "2026-08-01T00:00:00.000Z"
            }
          }
        ]}
        supplierSearchQuery=""
        supplierStatusFilter="all"
        supplierSortState={{ key: "vendorId", direction: "asc" }}
        showSupplierForm={false}
        editingSupplier={null}
        pendingSupplierUsageChange={null}
        onCreateSupplier={onCreateSupplier}
        onEditSupplier={onEditSupplier}
        onToggleSupplierUsage={onToggleSupplierUsage}
        onCloseSupplierForm={vi.fn()}
        onClosePendingSupplierUsageChange={vi.fn()}
        onExportCsv={vi.fn()}
        onSupplierSearchChange={vi.fn()}
        onSupplierStatusFilterChange={vi.fn()}
        onSupplierPageChange={vi.fn()}
        onSort={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Vendor Management" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Vendor" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Block" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Status filter" })).toBeInTheDocument();
    expect(screen.getByText("Page 1/2")).toBeInTheDocument();

    expect(onCreateSupplier).toBeDefined();
    expect(onEditSupplier).toBeDefined();
    expect(onToggleSupplierUsage).toBeDefined();
  });

  it("creates a supplier from the inline form", async () => {
    const apiRequest = vi.fn().mockResolvedValue({ data: { id: "sup-2" } });
    const onActivity = vi.fn();
    const onBusyChange = vi.fn();
    const onRefreshCoreData = vi.fn().mockResolvedValue(undefined);
    const onCloseSupplierForm = vi.fn();

    render(
      <WorkbenchSuppliersSection
        busy={false}
        canExportCsv={true}
        canManageCatalog={true}
        hasSuppliers={true}
        isOrgScopedReady={true}
        apiRequest={apiRequest}
        onActivity={onActivity}
        onBusyChange={onBusyChange}
        onRefreshCoreData={onRefreshCoreData}
        supplierPage={1}
        supplierTotalPages={1}
        supplierTableRows={[]}
        supplierSearchQuery=""
        supplierStatusFilter="all"
        showSupplierForm={true}
        editingSupplier={null}
        pendingSupplierUsageChange={null}
        onCreateSupplier={vi.fn()}
        onEditSupplier={vi.fn()}
        onToggleSupplierUsage={vi.fn()}
        onCloseSupplierForm={onCloseSupplierForm}
        onClosePendingSupplierUsageChange={vi.fn()}
        onExportCsv={vi.fn()}
        onSupplierSearchChange={vi.fn()}
        onSupplierStatusFilterChange={vi.fn()}
        onSupplierPageChange={vi.fn()}
        onSort={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Create Supplier" }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
    expect(apiRequest).toHaveBeenCalledWith("/api/suppliers", {
      method: "POST",
      body: {
        name: "Acme Supply",
        phone: undefined,
        address: undefined,
        lead_time_days: 5
      }
    });
    expect(onCloseSupplierForm).toHaveBeenCalledTimes(1);
    expect(onRefreshCoreData).toHaveBeenCalledTimes(1);
    expect(onActivity).toHaveBeenCalledWith("Supplier created.");
    expect(onBusyChange).toHaveBeenCalledWith(true);
    expect(onBusyChange).toHaveBeenCalledWith(false);
  });

  it("routes supplier pagination controls through the page callback", () => {
    const onSupplierPageChange = vi.fn();

    render(
      <WorkbenchSuppliersSection
        busy={false}
        canExportCsv={false}
        canManageCatalog={false}
        hasSuppliers={true}
        isOrgScopedReady={true}
        apiRequest={vi.fn()}
        onActivity={vi.fn()}
        onBusyChange={vi.fn()}
        onRefreshCoreData={vi.fn().mockResolvedValue(undefined)}
        supplierPage={2}
        supplierTotalPages={3}
        supplierTableRows={[]}
        supplierSearchQuery=""
        supplierStatusFilter="all"
        showSupplierForm={false}
        editingSupplier={null}
        pendingSupplierUsageChange={null}
        onCreateSupplier={vi.fn()}
        onEditSupplier={vi.fn()}
        onToggleSupplierUsage={vi.fn()}
        onCloseSupplierForm={vi.fn()}
        onClosePendingSupplierUsageChange={vi.fn()}
        onExportCsv={vi.fn()}
        onSupplierSearchChange={vi.fn()}
        onSupplierStatusFilterChange={vi.fn()}
        onSupplierPageChange={onSupplierPageChange}
        onSort={vi.fn()}
      />
    );

    const paginationRegion = screen.getByText("Page 2/3").closest("div.actions") as HTMLElement | null;
    if (!paginationRegion) {
      throw new Error("pagination controls not found");
    }
    const { getByRole } = within(paginationRegion);
    const previousButton = getByRole("button", { name: "Previous" });
    const nextButton = getByRole("button", { name: "Next" });

    fireEvent.click(previousButton);
    fireEvent.click(nextButton);

    expect(onSupplierPageChange).toHaveBeenCalledTimes(2);
    expect(onSupplierPageChange).toHaveBeenNthCalledWith(1, expect.any(Function));
    expect(onSupplierPageChange).toHaveBeenNthCalledWith(2, expect.any(Function));
  });
});
