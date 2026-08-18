"use client";

import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";

import { useLanguage } from "@/components/language-provider";
import { message, type StaticMessageKey } from "@/lib/i18n";
import { type SortState } from "@/lib/ui/table-tools";

type SortableHeaderProps = {
  tableId: "inventory";
  sortKey: string;
  label: string;
  sortState: SortState | undefined;
  onSort: (tableId: "inventory", key: string) => void;
  sortAriaLabel: string;
};

function SortableHeader({ tableId, sortKey, label, sortState, onSort, sortAriaLabel }: SortableHeaderProps) {
  const isActive = sortState?.key === sortKey;
  const direction = isActive ? sortState?.direction : "desc";
  const ariaSort = isActive ? (direction === "asc" ? "ascending" : "descending") : "none";

  return (
    <th aria-sort={ariaSort}>
      <button
        type="button"
        className={`table-sort-btn ${isActive ? "table-sort-active" : ""}`}
        aria-label={sortAriaLabel}
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
  const { locale } = useLanguage();
  const t = (key: StaticMessageKey) => message(locale, key);
  const sortAriaLabel = (label: string, sortKey: string) => {
    const active = inventorySortState?.key === sortKey;
    const state = active ? t(inventorySortState?.direction === "asc" ? "workbench.table.ascending" : "workbench.table.descending") : "";
    return message(locale, "workbench.table.sortBy", { label, state });
  };
  const statusLabel = (status: InventoryRow["status"]) => {
    const keys: Record<InventoryRow["status"], StaticMessageKey> = {
      "in-stock": "workbench.snapshot.inStock",
      "low-stock": "workbench.snapshot.lowStock",
      "out-of-stock": "workbench.snapshot.outOfStockStatus"
    };
    return t(keys[status]);
  };
  return (
    <section className="card">
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top">
            <p>{t("workbench.snapshot.totalMaterials")}</p>
            <span className="kpi-dot kpi-blue" aria-hidden="true">
              ▣
            </span>
          </div>
          <strong>{metrics.totalMaterials}</strong>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <p>{t("workbench.snapshot.lowStockAlerts")}</p>
            <span className="kpi-dot kpi-amber" aria-hidden="true">
              ↘
            </span>
          </div>
          <strong>{lowStockCount ?? stockHealth?.low_stock ?? metrics.lowStock}</strong>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <p>{t("workbench.snapshot.outOfStock")}</p>
            <span className="kpi-dot kpi-red" aria-hidden="true">
              !
            </span>
          </div>
          <strong>{stockHealth?.out_of_stock ?? metrics.outOfStock}</strong>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <p>{t("workbench.snapshot.totalValue")}</p>
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
              placeholder={t("workbench.material.searchPlaceholder")}
            />
          </div>
          <div className="category-wrap">
            <span className="field-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                <path d="M7 10l5 5 5-5H7Z" />
              </svg>
            </span>
            <select value={inventoryStatus} onChange={(event) => onInventoryStatusChange(event.target.value)} aria-label={t("workbench.snapshot.inventoryStatusLabel")}>
              <option value="all">{t("workbench.location.allStatuses")}</option>
              <option value="in-stock">{t("workbench.snapshot.inStock")}</option>
              <option value="low-stock">{t("workbench.snapshot.lowStock")}</option>
              <option value="out-of-stock">{t("workbench.snapshot.outOfStockStatus")}</option>
            </select>
          </div>
          <div className="category-wrap">
            <span className="field-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                <path d="M7 10l5 5 5-5H7Z" />
              </svg>
            </span>
            <select value={inventoryLocation} onChange={(event) => onInventoryLocationChange(event.target.value)} aria-label={t("workbench.movement.location")}>
              {inventoryLocations.map((location) => (
                <option key={location} value={location}>
                  {location === "all" ? t("workbench.movement.allLocations") : location}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="table-section-head">
          <h2>{t("workbench.snapshot.inventoryStatus")}</h2>
          <div className="actions table-head-actions inventory-table-actions">
            {canManageCatalog ? (
              <Link className="ghost-btn link-button" href="/materials">
                {t("workbench.material.create")}
              </Link>
            ) : null}
            {canCreateStockMovement ? (
              <Link className="ghost-btn link-button" href="/stock-movements">
                {t("workbench.movement.open")}
              </Link>
            ) : null}
            {canManageCatalog ? (
              <Link className="ghost-btn link-button" href="/purchase-orders">
                {t("workbench.snapshot.orderMaterial")}
              </Link>
            ) : null}
            {canExportCsv ? (
              <button type="button" className="ghost-btn export-csv-btn" disabled={inventoryTableRows.length === 0} onClick={onExportCsv}>
                {t("workbench.location.exportCsv")}
              </button>
            ) : null}
          </div>
        </div>
        {inventoryTableRows.length === 0 ? (
          <p>{t("workbench.snapshot.none")}</p>
        ) : (
          <div className="table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <SortableHeader tableId="inventory" sortKey="sku" label={t("workbench.material.sku")} sortState={inventorySortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.material.sku"), "sku")} />
                  <SortableHeader tableId="inventory" sortKey="name" label={t("workbench.snapshot.itemName")} sortState={inventorySortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.snapshot.itemName"), "name")} />
                  <SortableHeader tableId="inventory" sortKey="category" label={t("workbench.material.category")} sortState={inventorySortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.material.category"), "category")} />
                  <SortableHeader tableId="inventory" sortKey="subcategory" label={t("workbench.material.subcategory")} sortState={inventorySortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.material.subcategory"), "subcategory")} />
                  <SortableHeader tableId="inventory" sortKey="quantity" label={t("workbench.movement.quantity")} sortState={inventorySortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.movement.quantity"), "quantity")} />
                  <SortableHeader tableId="inventory" sortKey="uom" label={t("workbench.material.uom")} sortState={inventorySortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.material.uom"), "uom")} />
                  <SortableHeader tableId="inventory" sortKey="pricePerUnit" label={t("workbench.snapshot.pricePerUnit")} sortState={inventorySortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.snapshot.pricePerUnit"), "pricePerUnit")} />
                  <SortableHeader tableId="inventory" sortKey="total" label={t("workbench.snapshot.total")} sortState={inventorySortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.snapshot.total"), "total")} />
                  <SortableHeader tableId="inventory" sortKey="location" label={t("workbench.movement.location")} sortState={inventorySortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.movement.location"), "location")} />
                  <SortableHeader tableId="inventory" sortKey="statusLabel" label={t("workbench.location.status")} sortState={inventorySortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.location.status"), "statusLabel")} />
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
                      <span className={`status-pill status-${row.status}`}>{statusLabel(row.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="actions">
          <button type="button" disabled={busy || materialPage <= 1} onClick={() => onMaterialPageChange((prev) => Math.max(1, prev - 1))}>
            {t("workbench.location.previous")}
          </button>
          <button type="button" disabled={busy || materialPage >= materialTotalPages} onClick={() => onMaterialPageChange((prev) => Math.min(materialTotalPages, prev + 1))}>
            {t("workbench.location.next")}
          </button>
          <p className="subtle-line">
            {message(locale, "workbench.location.page", { page: String(materialPage), total: String(materialTotalPages) })}
          </p>
        </div>
      </section>
    </section>
  );
}
