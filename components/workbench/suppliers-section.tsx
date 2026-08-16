import { useEffect, useState } from "react";

import { PHONE_COUNTRY_CODES, buildPhoneNumber, formatVendorNumber, splitPhoneNumber } from "@/lib/ui/vendor-fields";

type SortDirection = "asc" | "desc";
type TableId = "suppliers";

type SortState = {
  key: string;
  direction: SortDirection;
};

export type WorkbenchSupplier = {
  id: string;
  vendor_number: number | null;
  name: string;
  phone?: string | null;
  address?: string | null;
  lead_time_days: number;
  is_active: boolean;
  created_at: string;
};

export type WorkbenchSupplierRow = {
  supplierId: string;
  vendorId: string;
  name: string;
  phone: string;
  address: string;
  leadTimeDays: number;
  status: string;
  openOrders: number;
  receivedOrders: number;
  totalOrders: number;
  editableSupplier: WorkbenchSupplier | undefined;
};

type SortableHeaderProps = {
  tableId: TableId;
  sortKey: string;
  label: string;
  sortState?: SortState;
  onSort: (tableId: TableId, sortKey: string) => void;
};

function SearchFieldIcon() {
  return (
    <svg className="search-field-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M10 4a6 6 0 104.472 10.007l4.26 4.26 1.414-1.414-4.26-4.26A6 6 0 0010 4zm0 2a4 4 0 110 8 4 4 0 010-8z" />
    </svg>
  );
}

function SelectFieldIcon() {
  return (
    <svg className="select-field-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 10l5 5 5-5H7z" />
    </svg>
  );
}

function SortableHeader({ tableId, sortKey, label, sortState, onSort }: SortableHeaderProps) {
  const active = sortState?.key === sortKey;
  const direction = active ? sortState?.direction : "desc";
  const ariaSort = active ? (direction === "asc" ? "ascending" : "descending") : "none";

  return (
    <th aria-sort={ariaSort}>
      <button
        type="button"
        className={`table-sort-btn ${active ? "table-sort-active" : ""}`}
        aria-label={`Sort by ${label}${active ? `, ${ariaSort}` : ""}`}
        aria-pressed={active}
        onClick={() => onSort(tableId, sortKey)}
      >
        <span className="table-static-head">{label}</span>
        {active ? <span aria-hidden="true">{direction === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    </th>
  );
}

type WorkbenchSuppliersSectionProps = {
  busy: boolean;
  canExportCsv: boolean;
  canManageCatalog: boolean;
  hasSuppliers: boolean;
  isOrgScopedReady: boolean;
  apiRequest: <T>(
    path: string,
    options?: {
      method?: "GET" | "POST" | "PATCH" | "DELETE";
      body?: Record<string, unknown>;
      orgOverride?: string;
      requireOrg?: boolean;
      tokenOverride?: string;
    }
  ) => Promise<T>;
  onActivity: (message: string) => void;
  onBusyChange: (busy: boolean) => void;
  onRefreshCoreData: () => Promise<void>;
  supplierPage: number;
  supplierTotalPages: number;
  supplierTableRows: WorkbenchSupplierRow[];
  supplierSearchQuery: string;
  supplierStatusFilter: string;
  supplierSortState?: SortState;
  showSupplierForm: boolean;
  editingSupplier: WorkbenchSupplier | null;
  pendingSupplierUsageChange: WorkbenchSupplier | null;
  onCreateSupplier: () => void;
  onEditSupplier: (supplier: WorkbenchSupplier) => void;
  onToggleSupplierUsage: (supplier: WorkbenchSupplier) => void;
  onCloseSupplierForm: () => void;
  onClosePendingSupplierUsageChange: () => void;
  onExportCsv: () => void;
  onSupplierSearchChange: (nextValue: string) => void;
  onSupplierStatusFilterChange: (nextValue: string) => void;
  onSupplierPageChange: (updater: number | ((prev: number) => number)) => void;
  onSort: (tableId: TableId, sortKey: string) => void;
};

export function WorkbenchSuppliersSection({
  busy,
  canExportCsv,
  canManageCatalog,
  hasSuppliers,
  isOrgScopedReady,
  apiRequest,
  onActivity,
  onBusyChange,
  onRefreshCoreData,
  supplierPage,
  supplierTotalPages,
  supplierTableRows,
  supplierSearchQuery,
  supplierStatusFilter,
  supplierSortState,
  showSupplierForm,
  editingSupplier,
  pendingSupplierUsageChange,
  onCreateSupplier,
  onEditSupplier,
  onToggleSupplierUsage,
  onCloseSupplierForm,
  onClosePendingSupplierUsageChange,
  onExportCsv,
  onSupplierSearchChange,
  onSupplierStatusFilterChange,
  onSupplierPageChange,
  onSort
}: WorkbenchSuppliersSectionProps) {
  const [supplierVendorNumber, setSupplierVendorNumber] = useState<number | null>(null);
  const [supplierName, setSupplierName] = useState("Acme Supply");
  const [supplierPhoneCountryCode, setSupplierPhoneCountryCode] = useState("+33");
  const [supplierPhoneNumber, setSupplierPhoneNumber] = useState("");
  const [supplierLeadTime, setSupplierLeadTime] = useState(5);
  const [supplierAddress, setSupplierAddress] = useState("");

  useEffect(() => {
    if (!showSupplierForm) {
      setSupplierVendorNumber(null);
      setSupplierName("Acme Supply");
      setSupplierPhoneCountryCode("+33");
      setSupplierPhoneNumber("");
      setSupplierLeadTime(5);
      setSupplierAddress("");
      return;
    }

    if (editingSupplier) {
      const { countryCode, localNumber } = splitPhoneNumber(editingSupplier.phone);
      setSupplierVendorNumber(editingSupplier.vendor_number ?? null);
      setSupplierName(editingSupplier.name);
      setSupplierPhoneCountryCode(countryCode);
      setSupplierPhoneNumber(localNumber);
      setSupplierLeadTime(Number(editingSupplier.lead_time_days || 0));
      setSupplierAddress(editingSupplier.address ?? "");
    }
  }, [editingSupplier, showSupplierForm]);

  async function handleSaveSupplier() {
    try {
      onBusyChange(true);
      const payload = {
        name: supplierName,
        phone: buildPhoneNumber(supplierPhoneCountryCode, supplierPhoneNumber),
        address: supplierAddress.trim() || undefined,
        lead_time_days: Number(supplierLeadTime)
      };

      if (editingSupplier) {
        await apiRequest(`/api/suppliers/${editingSupplier.id}`, {
          method: "PATCH",
          body: payload
        });
        onActivity("Supplier updated.");
      } else {
        await apiRequest("/api/suppliers", {
          method: "POST",
          body: payload
        });
        onActivity("Supplier created.");
      }

      onCloseSupplierForm();
      await onRefreshCoreData();
    } catch (error) {
      onActivity(
        editingSupplier
          ? `Update supplier failed: ${(error as Error).message}`
          : `Create supplier failed: ${(error as Error).message}`
      );
    } finally {
      onBusyChange(false);
    }
  }

  async function handleConfirmSupplierUsageChange() {
    if (!pendingSupplierUsageChange) {
      return;
    }

    const nextIsActive = pendingSupplierUsageChange.is_active === false;

    try {
      onBusyChange(true);
      await apiRequest(`/api/suppliers/${pendingSupplierUsageChange.id}`, {
        method: "PATCH",
        body: {
          is_active: nextIsActive
        }
      });
      onActivity(`${pendingSupplierUsageChange.name} ${nextIsActive ? "unblocked for usage" : "blocked for usage"}.`);
      onClosePendingSupplierUsageChange();
      await onRefreshCoreData();
    } catch (error) {
      onActivity(`Update supplier usage failed: ${(error as Error).message}`);
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <>
      <section className="card">
        <div className="inventory-toolbar location-toolbar">
          <div className="search-input-wrap">
            <SearchFieldIcon />
            <input
              value={supplierSearchQuery}
              onChange={(event) => onSupplierSearchChange(event.target.value)}
              placeholder="Filter by vendor name, ID, phone, or address"
              aria-label="Supplier search"
            />
          </div>
          <div className="category-wrap">
            <SelectFieldIcon />
            <select
              value={supplierStatusFilter}
              onChange={(event) => onSupplierStatusFilterChange(event.target.value)}
              aria-label="Status filter"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="table-section-head">
          <h2>Vendor Management</h2>
          <div className="actions table-head-actions inventory-table-actions">
            {canManageCatalog ? (
              <button type="button" className="ghost-btn" onClick={onCreateSupplier}>
                Add Vendor
              </button>
            ) : null}
            {canExportCsv ? (
              <button type="button" className="ghost-btn export-csv-btn" disabled={supplierTableRows.length === 0} onClick={onExportCsv}>
                Export CSV
              </button>
            ) : null}
          </div>
        </div>

        <div className="table-wrap">
          <table className="compact-table vendors-table">
            <thead>
              <tr>
                <SortableHeader tableId="suppliers" sortKey="vendorId" label="Vendor ID" sortState={supplierSortState} onSort={onSort} />
                <SortableHeader tableId="suppliers" sortKey="name" label="Vendor Name" sortState={supplierSortState} onSort={onSort} />
                <SortableHeader tableId="suppliers" sortKey="phone" label="Phone" sortState={supplierSortState} onSort={onSort} />
                <SortableHeader tableId="suppliers" sortKey="address" label="Address" sortState={supplierSortState} onSort={onSort} />
                <SortableHeader tableId="suppliers" sortKey="leadTimeDays" label="Lead Time (days)" sortState={supplierSortState} onSort={onSort} />
                <SortableHeader tableId="suppliers" sortKey="status" label="Status" sortState={supplierSortState} onSort={onSort} />
                <SortableHeader tableId="suppliers" sortKey="openOrders" label="Open POs" sortState={supplierSortState} onSort={onSort} />
                <SortableHeader tableId="suppliers" sortKey="receivedOrders" label="Received POs" sortState={supplierSortState} onSort={onSort} />
                <SortableHeader tableId="suppliers" sortKey="totalOrders" label="Total POs" sortState={supplierSortState} onSort={onSort} />
                <th>
                  <span className="table-static-head">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {supplierTableRows.length === 0 ? (
                <tr>
                  <td colSpan={10}>{hasSuppliers ? "No suppliers match these filters." : "No suppliers created yet."}</td>
                </tr>
              ) : (
                supplierTableRows.map((supplier) => {
                  const editableSupplier = supplier.editableSupplier;
                  return (
                    <tr key={supplier.supplierId}>
                      <td className="mono-line">{supplier.vendorId}</td>
                      <td>{supplier.name}</td>
                      <td>{supplier.phone}</td>
                      <td>{supplier.address}</td>
                      <td>{supplier.leadTimeDays}</td>
                      <td>
                        <span className={`status-pill ${supplier.status === "Active" ? "status-received" : "status-cancelled"}`}>{supplier.status}</span>
                      </td>
                      <td>{supplier.openOrders}</td>
                      <td>{supplier.receivedOrders}</td>
                      <td>{supplier.totalOrders}</td>
                      <td>
                        {editableSupplier && canManageCatalog ? (
                          <div className="row-actions table-action-buttons">
                            <button type="button" className="ghost-btn" disabled={busy} onClick={() => onEditSupplier(editableSupplier)}>
                              Edit
                            </button>
                            <button type="button" className="ghost-btn" disabled={busy} onClick={() => onToggleSupplierUsage(editableSupplier)}>
                              {editableSupplier.is_active === false ? "Unblock" : "Block"}
                            </button>
                          </div>
                        ) : (
                          <span className="subtle-line">No actions</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      <div className="actions">
        <button type="button" disabled={busy || supplierPage <= 1} onClick={() => onSupplierPageChange((prev) => Math.max(1, prev - 1))}>
          Previous
          </button>
          <button type="button" disabled={busy || supplierPage >= supplierTotalPages} onClick={() => onSupplierPageChange((prev) => Math.min(supplierTotalPages, prev + 1))}>
            Next
          </button>
          <p className="subtle-line">
            Page {supplierPage}/{supplierTotalPages}
          </p>
        </div>
      </section>

      {showSupplierForm && canManageCatalog ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={editingSupplier ? "Edit vendor" : "Add vendor"}>
          <div className="modal-card">
            <div className="title-row">
              <h4>{editingSupplier ? "Edit Vendor" : "Add Vendor"}</h4>
              <button type="button" className="ghost-btn" onClick={onCloseSupplierForm}>
                Close
              </button>
            </div>
            <div className="grid grid-2">
              <label className="field">
                <span>Vendor ID</span>
                <input readOnly value={formatVendorNumber(supplierVendorNumber)} placeholder="Assigned automatically" />
                <p className="subtle-line">Assigned automatically and cannot be changed.</p>
              </label>
              <label className="field">
                <span>Name</span>
                <input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} />
              </label>
              <label className="field field-span-2">
                <span>Phone</span>
                <div className="phone-input-row">
                  <select value={supplierPhoneCountryCode} onChange={(event) => setSupplierPhoneCountryCode(event.target.value)}>
                    {PHONE_COUNTRY_CODES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={supplierPhoneNumber}
                    onChange={(event) => setSupplierPhoneNumber(event.target.value)}
                    placeholder="6 12 34 56 78"
                  />
                </div>
              </label>
              <label className="field">
                <span>Lead Time (days)</span>
                <input type="number" min={0} value={supplierLeadTime} onChange={(event) => setSupplierLeadTime(Number(event.target.value))} />
              </label>
              <label className="field field-span-2">
                <span>Address</span>
                <textarea maxLength={256} rows={3} value={supplierAddress} onChange={(event) => setSupplierAddress(event.target.value)} />
              </label>
            </div>
            <div className="actions">
              <button type="button" disabled={busy || !isOrgScopedReady || !supplierName.trim()} onClick={() => void handleSaveSupplier()}>
                {editingSupplier ? "Update Vendor" : "Create Supplier"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingSupplierUsageChange ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm vendor usage change">
          <div className="modal-card">
            <div className="title-row">
              <h4>{pendingSupplierUsageChange.is_active === false ? "Unblock vendor" : "Block vendor"}</h4>
              <button type="button" className="ghost-btn" disabled={busy} onClick={onClosePendingSupplierUsageChange}>
                Close
              </button>
            </div>
            <p>
              {pendingSupplierUsageChange.is_active === false
                ? `Unblock ${pendingSupplierUsageChange.name} for new usage?`
                : `Block ${pendingSupplierUsageChange.name} from new usage?`}
            </p>
            <div className="actions">
              <button type="button" disabled={busy} onClick={() => void handleConfirmSupplierUsageChange()}>
                Confirm
              </button>
              <button type="button" className="ghost-btn" disabled={busy} onClick={onClosePendingSupplierUsageChange}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
