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
  return (
    <>
      <section className="card">
        <div className="inventory-toolbar location-toolbar">
          <div className="search-input-wrap">
            <SearchFieldIcon />
            <input
              value={locationSearchQuery}
              onChange={(event) => onLocationSearchChange(event.target.value)}
              placeholder="Search by code, name or address..."
              aria-label="Location search"
            />
          </div>
          <div className="category-wrap">
            <SelectFieldIcon />
            <select
              value={locationStatusFilter}
              onChange={(event) => onLocationStatusFilterChange(event.target.value)}
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
          <h2>Location Management</h2>
          <div className="actions table-head-actions inventory-table-actions">
            {canManageCatalog ? (
              <button type="button" className="ghost-btn" onClick={onCreateLocation}>
                Add Location
              </button>
            ) : null}
            {canExportCsv ? (
              <button type="button" className="ghost-btn export-csv-btn" disabled={locationTableRows.length === 0} onClick={onExportCsv}>
                Export CSV
              </button>
            ) : null}
          </div>
        </div>

        <div className="table-wrap">
          <table className="compact-table locations-table">
            <thead>
              <tr>
                <SortableHeader tableId="locations" sortKey="code" label="Code" sortState={locationSortState} onSort={onSort} />
                <SortableHeader tableId="locations" sortKey="name" label="Name" sortState={locationSortState} onSort={onSort} />
                <SortableHeader tableId="locations" sortKey="address" label="Address" sortState={locationSortState} onSort={onSort} />
                <SortableHeader tableId="locations" sortKey="status" label="Status" sortState={locationSortState} onSort={onSort} />
                <SortableHeader tableId="locations" sortKey="lowStock" label="Low stock" sortState={locationSortState} onSort={onSort} />
                <SortableHeader tableId="locations" sortKey="outOfStock" label="Out of stock" sortState={locationSortState} onSort={onSort} />
                <th>
                  <span className="table-static-head">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {locationTableRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>{hasLocations ? "No locations match these filters." : "No locations created yet."}</td>
                </tr>
              ) : (
                locationTableRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.code}</td>
                    <td>{row.name}</td>
                    <td>{row.address}</td>
                    <td>{row.status}</td>
                    <td>{row.lowStock}</td>
                    <td>{row.outOfStock}</td>
                    <td>
                      {canManageCatalog ? (
                        <div className="row-actions table-action-buttons">
                          <button type="button" className="ghost-btn" disabled={busy} onClick={() => onEditLocation(row.location)}>
                            Edit
                          </button>
                          <button type="button" className="ghost-btn" disabled={busy} onClick={() => onToggleLocationUsage(row.location)}>
                            {row.location.is_active === false ? "Unblock" : "Block"}
                          </button>
                        </div>
                      ) : (
                        <span className="subtle-line">No actions</span>
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
            Previous
          </button>
          <button type="button" disabled={busy || locationPage >= locationTotalPages} onClick={() => onLocationPageChange((prev) => Math.min(locationTotalPages, prev + 1))}>
            Next
          </button>
          <p className="subtle-line">
            Page {locationPage}/{locationTotalPages}
          </p>
        </div>
      </section>
    </>
  );
}
