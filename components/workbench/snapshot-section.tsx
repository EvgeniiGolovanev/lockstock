"use client";

import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";

import { type SortState } from "@/lib/ui/table-tools";

type SortableHeaderProps = {
  tableId: "inventory";
  sortKey: string;
  label: string;
  sortState: SortState | undefined;
  onSort: (tableId: "inventory", key: string) => void;
};

function SortableHeader({ tableId, sortKey, label, sortState, onSort }: SortableHeaderProps) {
  const isActive = sortState?.key === sortKey;
  const direction = isActive ? sortState?.direction : "desc";
  const ariaSort = isActive ? (direction === "asc" ? "ascending" : "descending") : "none";

  return (
    <th aria-sort={ariaSort}>
      <button
        type="button"
        className={`table-sort-btn ${isActive ? "table-sort-active" : ""}`}
        aria-label={`Sort by ${label}${isActive ? `, ${ariaSort}` : ""}`}
        aria-pressed={isActive}
        onClick={() => onSort(tableId, sortKey)}
      >
        <span className="table-static-head">{label}</span>
        {isActive ? <span aria-hidden="true">{direction === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    </th>
  );
}

type InventoryRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  quantity: string;
  uom: string;
  pricePerUnit: string;
  total: string;
  location: string;
  status: "in-stock" | "low-stock" | "out-of-stock";
  statusLabel: string;
  pricePerUnitExport: string;
  totalExport: string;
};

type SnapshotSectionProps = {
  busy: boolean;
  canManageCatalog: boolean;
  canCreateStockMovement: boolean;
  canExportCsv: boolean;
  metrics: {
    totalMaterials: number;
    lowStock: number;
    outOfStock: number;
  };
  lowStockCount: number | null;
  stockHealth: { low_stock: number; out_of_stock: number } | null;
  inventoryValueBadge: string;
  inventoryValueLabel: string;
  materialFilterQuery: string;
  inventoryStatus: string;
  inventoryLocation: string;
  inventoryLocations: string[];
  inventoryTableRows: InventoryRow[];
  materialPage: number;
  materialTotalPages: number;
  inventorySortState: SortState | undefined;
  onMaterialFilterQueryChange: (value: string) => void;
  onInventoryStatusChange: (value: string) => void;
  onInventoryLocationChange: (value: string) => void;
  onMaterialPageChange: Dispatch<SetStateAction<number>>;
  onExportCsv: () => void;
  onSort: (tableId: "inventory", key: string) => void;
};

export function WorkbenchSnapshotSection({
  busy,
  canManageCatalog,
  canCreateStockMovement,
  canExportCsv,
  metrics,
  lowStockCount,
  stockHealth,
  inventoryValueBadge,
  inventoryValueLabel,
  materialFilterQuery,
  inventoryStatus,
  inventoryLocation,
  inventoryLocations,
  inventoryTableRows,
  materialPage,
  materialTotalPages,
  inventorySortState,
  onMaterialFilterQueryChange,
  onInventoryStatusChange,
  onInventoryLocationChange,
  onMaterialPageChange,
  onExportCsv,
  onSort
}: SnapshotSectionProps) {
  return (
    <section className="card">
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top">
            <p>Total Materials</p>
            <span className="kpi-dot kpi-blue" aria-hidden="true">
              ▣
            </span>
          </div>
          <strong>{metrics.totalMaterials}</strong>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <p>Low Stock Alerts</p>
            <span className="kpi-dot kpi-amber" aria-hidden="true">
              ↘
            </span>
          </div>
          <strong>{lowStockCount ?? stockHealth?.low_stock ?? metrics.lowStock}</strong>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <p>Out of Stock</p>
            <span className="kpi-dot kpi-red" aria-hidden="true">
              !
            </span>
          </div>
          <strong>{stockHealth?.out_of_stock ?? metrics.outOfStock}</strong>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <p>Total Value</p>
            <span className="kpi-dot kpi-green" aria-hidden="true">
              {inventoryValueBadge}
            </span>
          </div>
          <strong>{inventoryValueLabel}</strong>
        </div>
      </div>

      <section className="card">
        <div className="inventory-toolbar">
          <div className="search-input-wrap">
            <span className="field-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                <path d="M10 4a6 6 0 1 0 3.87 10.63l4.75 4.75 1.41-1.41-4.75-4.75A6 6 0 0 0 10 4Zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
              </svg>
            </span>
            <input
              value={materialFilterQuery}
              onChange={(event) => onMaterialFilterQueryChange(event.target.value)}
              placeholder="Search by name or SKU..."
            />
          </div>
          <div className="category-wrap">
            <span className="field-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                <path d="M7 10l5 5 5-5H7Z" />
              </svg>
            </span>
            <select value={inventoryStatus} onChange={(event) => onInventoryStatusChange(event.target.value)} aria-label="Inventory status">
              <option value="all">All Statuses</option>
              <option value="in-stock">In Stock</option>
              <option value="low-stock">Low Stock</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
          </div>
          <div className="category-wrap">
            <span className="field-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                <path d="M7 10l5 5 5-5H7Z" />
              </svg>
            </span>
            <select value={inventoryLocation} onChange={(event) => onInventoryLocationChange(event.target.value)} aria-label="Location">
              {inventoryLocations.map((location) => (
                <option key={location} value={location}>
                  {location === "all" ? "All Locations" : location}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="table-section-head">
          <h2>Inventory status</h2>
          <div className="actions table-head-actions inventory-table-actions">
            {canManageCatalog ? (
              <Link className="ghost-btn link-button" href="/materials">
                Create Material
              </Link>
            ) : null}
            {canCreateStockMovement ? (
              <Link className="ghost-btn link-button" href="/stock-movements">
                Move Material
              </Link>
            ) : null}
            {canManageCatalog ? (
              <Link className="ghost-btn link-button" href="/purchase-orders">
                Order Material
              </Link>
            ) : null}
            {canExportCsv ? (
              <button type="button" className="ghost-btn export-csv-btn" disabled={inventoryTableRows.length === 0} onClick={onExportCsv}>
                Export CSV
              </button>
            ) : null}
          </div>
        </div>
        {inventoryTableRows.length === 0 ? (
          <p>No inventory items match these filters.</p>
        ) : (
          <div className="table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <SortableHeader tableId="inventory" sortKey="sku" label="SKU" sortState={inventorySortState} onSort={onSort} />
                  <SortableHeader tableId="inventory" sortKey="name" label="Item Name" sortState={inventorySortState} onSort={onSort} />
                  <SortableHeader tableId="inventory" sortKey="category" label="Category" sortState={inventorySortState} onSort={onSort} />
                  <SortableHeader tableId="inventory" sortKey="subcategory" label="Subcategory" sortState={inventorySortState} onSort={onSort} />
                  <SortableHeader tableId="inventory" sortKey="quantity" label="Quantity" sortState={inventorySortState} onSort={onSort} />
                  <SortableHeader tableId="inventory" sortKey="uom" label="UoM" sortState={inventorySortState} onSort={onSort} />
                  <SortableHeader tableId="inventory" sortKey="pricePerUnit" label="Price per unit" sortState={inventorySortState} onSort={onSort} />
                  <SortableHeader tableId="inventory" sortKey="total" label="Total" sortState={inventorySortState} onSort={onSort} />
                  <SortableHeader tableId="inventory" sortKey="location" label="Location" sortState={inventorySortState} onSort={onSort} />
                  <SortableHeader tableId="inventory" sortKey="statusLabel" label="Status" sortState={inventorySortState} onSort={onSort} />
                </tr>
              </thead>
              <tbody>
                {inventoryTableRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.sku}</td>
                    <td>{row.name}</td>
                    <td>{row.category}</td>
                    <td>{row.subcategory}</td>
                    <td>{row.quantity}</td>
                    <td>{row.uom}</td>
                    <td>{row.pricePerUnit}</td>
                    <td>{row.total}</td>
                    <td>{row.location}</td>
                    <td>
                      <span className={`status-pill status-${row.status}`}>{row.statusLabel}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="actions">
          <button type="button" disabled={busy || materialPage <= 1} onClick={() => onMaterialPageChange((prev) => Math.max(1, prev - 1))}>
            Previous
          </button>
          <button type="button" disabled={busy || materialPage >= materialTotalPages} onClick={() => onMaterialPageChange((prev) => Math.min(materialTotalPages, prev + 1))}>
            Next
          </button>
          <p className="subtle-line">
            Page {materialPage}/{materialTotalPages}
          </p>
        </div>
      </section>
    </section>
  );
}
