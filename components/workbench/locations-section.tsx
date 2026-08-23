import { useLanguage } from "@/components/language-provider";
import { message, type StaticMessageKey } from "@/lib/i18n";
import styles from "./locations-section.module.css";

type SortDirection = "asc" | "desc";
type TableId = "locations";

type SortState = {
  key: string;
  direction: SortDirection;
};

export type WorkbenchLocation = {
  id: string;
  code: string | null;
  name: string;
  address?: string | null;
  is_active: boolean;
};

export type WorkbenchLocationRow = {
  id: string;
  code: string;
  name: string;
  address: string;
  status: string;
  lowStock: number;
  outOfStock: number;
  location: WorkbenchLocation;
};

type SortableHeaderProps = {
  tableId: TableId;
  sortKey: string;
  label: string;
  sortState?: SortState;
  onSort: (tableId: TableId, sortKey: string) => void;
  sortAriaLabel: string;
};

function SearchFieldIcon() {
  return (
    <svg className="field-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M10 4a6 6 0 104.472 10.007l4.26 4.26 1.414-1.414-4.26-4.26A6 6 0 0010 4zm0 2a4 4 0 110 8 4 4 0 010-8z" />
    </svg>
  );
}

function SelectFieldIcon() {
  return (
    <svg className="field-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 10l5 5 5-5H7z" />
    </svg>
  );
}

function SortableHeader({ tableId, sortKey, label, sortState, onSort, sortAriaLabel }: SortableHeaderProps) {
  const active = sortState?.key === sortKey;
  const direction = active ? sortState?.direction : "desc";
  const ariaSort = active ? (direction === "asc" ? "ascending" : "descending") : "none";

  return (
    <th aria-sort={ariaSort}>
      <button
        type="button"
        className={`table-sort-btn ${active ? "table-sort-active" : ""}`}
        aria-label={sortAriaLabel}
        aria-pressed={active}
        onClick={() => onSort(tableId, sortKey)}
      >
        <span className="table-static-head">{label}</span>
        {active ? <span aria-hidden="true">{direction === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    </th>
  );
}

const LOCATION_STATUS_KEYS: Record<string, StaticMessageKey> = {
  Active: "workbench.location.active",
  Blocked: "workbench.location.blocked"
};

type WorkbenchLocationsSectionProps = {
  busy: boolean;
  canExportCsv: boolean;
  canManageCatalog: boolean;
  hasLocations: boolean;
  locationPage: number;
  locationTotalPages: number;
  locationTableRows: WorkbenchLocationRow[];
  locationSearchQuery: string;
  locationStatusFilter: string;
  locationSortState?: SortState;
  onCreateLocation: () => void;
  onEditLocation: (location: WorkbenchLocation) => void;
  onToggleLocationUsage: (location: WorkbenchLocation) => void;
  onExportCsv: () => void;
  onLocationSearchChange: (nextValue: string) => void;
  onLocationStatusFilterChange: (nextValue: string) => void;
  onLocationPageChange: (updater: number | ((prev: number) => number)) => void;
  onSort: (tableId: TableId, sortKey: string) => void;
};

export function WorkbenchLocationsSection({
  busy,
  canExportCsv,
  canManageCatalog,
  hasLocations,
  locationPage,
  locationTotalPages,
  locationTableRows,
  locationSearchQuery,
  locationStatusFilter,
  locationSortState,
  onCreateLocation,
  onEditLocation,
  onToggleLocationUsage,
  onExportCsv,
  onLocationSearchChange,
  onLocationStatusFilterChange,
  onLocationPageChange,
  onSort
}: WorkbenchLocationsSectionProps) {
  const { locale } = useLanguage();
  const t = (key: StaticMessageKey) => message(locale, key);
  const statusLabel = (status: string) => t(LOCATION_STATUS_KEYS[status] ?? "workbench.location.status");
  const sortAriaLabel = (label: string, sortKey: string) => {
    const active = locationSortState?.key === sortKey;
    const state = active ? t(locationSortState?.direction === "asc" ? "workbench.table.ascending" : "workbench.table.descending") : "";
    return message(locale, "workbench.table.sortBy", { label, state });
  };

  return (
    <>
      <section className="card">
        <div className={`inventory-toolbar ${styles.toolbar}`}>
          <div className="search-input-wrap">
            <SearchFieldIcon />
            <input
              value={locationSearchQuery}
              onChange={(event) => onLocationSearchChange(event.target.value)}
              placeholder={t("workbench.location.searchPlaceholder")}
              aria-label={t("workbench.location.searchLabel")}
            />
          </div>
          <div className="category-wrap">
            <SelectFieldIcon />
            <select
              value={locationStatusFilter}
              onChange={(event) => onLocationStatusFilterChange(event.target.value)}
              aria-label={t("workbench.location.statusFilter")}
            >
              <option value="all">{t("workbench.location.allStatuses")}</option>
              <option value="active">{t("workbench.location.active")}</option>
              <option value="blocked">{t("workbench.location.blocked")}</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="table-section-head">
          <h2>{t("workbench.location.management")}</h2>
          <div className="actions table-head-actions inventory-table-actions">
            {canManageCatalog ? (
              <button type="button" className="ghost-btn" onClick={onCreateLocation}>
                {t("workbench.location.add")}
              </button>
            ) : null}
            {canExportCsv ? (
              <button type="button" className="ghost-btn export-csv-btn" disabled={locationTableRows.length === 0} onClick={onExportCsv}>
                {t("workbench.location.exportCsv")}
              </button>
            ) : null}
          </div>
        </div>

        <div className="table-wrap">
          <table className={`compact-table ${styles.locationsTable}`}>
            <thead>
              <tr>
                <SortableHeader tableId="locations" sortKey="code" label={t("workbench.location.code")} sortState={locationSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.location.code"), "code")} />
                <SortableHeader tableId="locations" sortKey="name" label={t("workbench.location.name")} sortState={locationSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.location.name"), "name")} />
                <SortableHeader tableId="locations" sortKey="address" label={t("workbench.location.address")} sortState={locationSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.location.address"), "address")} />
                <SortableHeader tableId="locations" sortKey="status" label={t("workbench.location.status")} sortState={locationSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.location.status"), "status")} />
                <SortableHeader tableId="locations" sortKey="lowStock" label={t("workbench.location.lowStock")} sortState={locationSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.location.lowStock"), "lowStock")} />
                <SortableHeader tableId="locations" sortKey="outOfStock" label={t("workbench.location.outOfStock")} sortState={locationSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.location.outOfStock"), "outOfStock")} />
                <th>
                  <span className="table-static-head">{t("workbench.location.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {locationTableRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>{hasLocations ? t("workbench.location.noMatch") : t("workbench.location.noLocations")}</td>
                </tr>
              ) : (
                locationTableRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.code}</td>
                    <td>{row.name}</td>
                    <td>{row.address}</td>
                    <td>{statusLabel(row.status)}</td>
                    <td>{row.lowStock}</td>
                    <td>{row.outOfStock}</td>
                    <td>
                      {canManageCatalog ? (
                        <div className="row-actions table-action-buttons">
                          <button type="button" className="ghost-btn" disabled={busy} onClick={() => onEditLocation(row.location)}>
                            {t("workbench.location.edit")}
                          </button>
                          <button type="button" className="ghost-btn" disabled={busy} onClick={() => onToggleLocationUsage(row.location)}>
                            {row.location.is_active === false ? t("workbench.location.unblock") : t("workbench.location.block")}
                          </button>
                        </div>
                      ) : (
                        <span className="subtle-line">{t("workbench.location.noActions")}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="actions">
          <button type="button" disabled={busy || locationPage <= 1} onClick={() => onLocationPageChange((prev) => Math.max(1, prev - 1))}>
            {t("workbench.location.previous")}
          </button>
          <button type="button" disabled={busy || locationPage >= locationTotalPages} onClick={() => onLocationPageChange((prev) => Math.min(locationTotalPages, prev + 1))}>
            {t("workbench.location.next")}
          </button>
          <p className="subtle-line">
            {message(locale, "workbench.location.page", { page: String(locationPage), total: String(locationTotalPages) })}
          </p>
        </div>
      </section>
    </>
  );
}
