type SortDirection = "asc" | "desc";
type TableId = "materials";

type SortState = {
  key: string;
  direction: SortDirection;
};

export type WorkbenchMaterial = {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  uom: string;
  category?: string | null;
  subcategory?: string | null;
  created_at?: string;
  min_stock: number;
  is_active: boolean;
  total_quantity?: number;
  primary_location?: string | null;
  stock_status?: "in-stock" | "low-stock" | "out-of-stock";
  balances?: Array<{
    quantity: number | string | null;
    location?: {
      code?: string | null;
      name: string;
    } | null;
  }>;
};

export type WorkbenchMaterialsRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  uom: string;
  minStock: number | string;
  status: string;
  createdAt: string;
  material: WorkbenchMaterial;
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

type WorkbenchMaterialsSectionProps = {
  busy: boolean;
  canExportCsv: boolean;
  canManageCatalog: boolean;
  isOrgScopedReady: boolean;
  materialPage: number;
  materialTotalPages: number;
  materialTableRows: WorkbenchMaterialsRow[];
  materialSearchQuery: string;
  materialCategoryFilter: string;
  materialSubcategoryFilter: string;
  materialCategoryOptions: readonly string[];
  materialFilterSubcategories: readonly string[];
  materialSortState?: SortState;
  onCreateMaterial: () => void;
  onEditMaterial: (material: WorkbenchMaterial) => void;
  onToggleMaterialUsage: (material: WorkbenchMaterial) => void;
  onExportCsv: () => void;
  onMaterialSearchChange: (nextValue: string) => void;
  onMaterialCategoryFilterChange: (nextValue: string) => void;
  onMaterialSubcategoryFilterChange: (nextValue: string) => void;
  onMaterialPageChange: (updater: number | ((prev: number) => number)) => void;
  onSort: (tableId: TableId, sortKey: string) => void;
};

export function WorkbenchMaterialsSection({
  busy,
  canExportCsv,
  canManageCatalog,
  isOrgScopedReady,
  materialPage,
  materialTotalPages,
  materialTableRows,
  materialSearchQuery,
  materialCategoryFilter,
  materialSubcategoryFilter,
  materialCategoryOptions,
  materialFilterSubcategories,
  materialSortState,
  onCreateMaterial,
  onEditMaterial,
  onToggleMaterialUsage,
  onExportCsv,
  onMaterialSearchChange,
  onMaterialCategoryFilterChange,
  onMaterialSubcategoryFilterChange,
  onMaterialPageChange,
  onSort
}: WorkbenchMaterialsSectionProps) {
  return (
    <>
      <section className="card">
        <div className="inventory-toolbar">
          <div className="search-input-wrap">
            <SearchFieldIcon />
            <input
              value={materialSearchQuery}
              onChange={(event) => onMaterialSearchChange(event.target.value)}
              placeholder="Search by name or SKU..."
              aria-label="Materials search"
            />
          </div>
          <div className="category-wrap">
            <SelectFieldIcon />
            <select
              value={materialCategoryFilter}
              onChange={(event) => {
                onMaterialCategoryFilterChange(event.target.value);
              }}
              aria-label="Category filter"
            >
              <option value="all">All Categories</option>
              {materialCategoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="category-wrap">
            <SelectFieldIcon />
            <select
              value={materialSubcategoryFilter}
              disabled={materialCategoryFilter === "all"}
              onChange={(event) => {
                onMaterialSubcategoryFilterChange(event.target.value);
              }}
              aria-label="Subcategory filter"
            >
              <option value="all">All Subcategories</option>
              {materialFilterSubcategories.map((subcategory) => (
                <option key={subcategory} value={subcategory}>
                  {subcategory}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="table-section-head">
          <h2>Materials</h2>
          <div className="actions table-head-actions inventory-table-actions">
            {canManageCatalog ? (
              <button type="button" className="ghost-btn" disabled={busy || !isOrgScopedReady} onClick={onCreateMaterial}>
                Create Material
              </button>
            ) : null}
            {canExportCsv ? (
              <button type="button" className="ghost-btn export-csv-btn" disabled={materialTableRows.length === 0} onClick={onExportCsv}>
                Export CSV
              </button>
            ) : null}
          </div>
        </div>

        {materialTableRows.length === 0 ? (
          <p>No materials match these filters.</p>
        ) : (
          <div className="table-wrap">
            <table className="compact-table materials-table">
              <thead>
                <tr>
                  <SortableHeader tableId="materials" sortKey="sku" label="SKU" sortState={materialSortState} onSort={onSort} />
                  <SortableHeader tableId="materials" sortKey="name" label="Name" sortState={materialSortState} onSort={onSort} />
                  <SortableHeader tableId="materials" sortKey="category" label="Category" sortState={materialSortState} onSort={onSort} />
                  <SortableHeader tableId="materials" sortKey="subcategory" label="Subcategory" sortState={materialSortState} onSort={onSort} />
                  <SortableHeader tableId="materials" sortKey="description" label="Description" sortState={materialSortState} onSort={onSort} />
                  <SortableHeader tableId="materials" sortKey="uom" label="UoM" sortState={materialSortState} onSort={onSort} />
                  <SortableHeader tableId="materials" sortKey="minStock" label="Minimum stock" sortState={materialSortState} onSort={onSort} />
                  <SortableHeader tableId="materials" sortKey="status" label="Status" sortState={materialSortState} onSort={onSort} />
                  <SortableHeader tableId="materials" sortKey="createdAt" label="Date and time of creation" sortState={materialSortState} onSort={onSort} />
                  <th>
                    <span className="table-static-head">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {materialTableRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.sku}</td>
                    <td>{row.name}</td>
                    <td>{row.category}</td>
                    <td>{row.subcategory}</td>
                    <td className="table-description-cell">{row.description}</td>
                    <td>{row.uom}</td>
                    <td>{row.minStock}</td>
                    <td>{row.status}</td>
                    <td>{row.createdAt}</td>
                    <td>
                      {canManageCatalog ? (
                        <div className="row-actions table-action-buttons">
                          <button type="button" className="ghost-btn" disabled={busy} onClick={() => onEditMaterial(row.material)}>
                            Edit
                          </button>
                          <button type="button" className="ghost-btn" disabled={busy} onClick={() => onToggleMaterialUsage(row.material)}>
                            {row.material.is_active === false ? "Unblock" : "Block"}
                          </button>
                        </div>
                      ) : (
                        <span className="subtle-line">No actions</span>
                      )}
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
    </>
  );
}
