import { useLanguage } from "@/components/language-provider";
import { message, type StaticMessageKey } from "@/lib/i18n";
import styles from "./materials-section.module.css";

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
  const { locale } = useLanguage();
  const t = (key: StaticMessageKey) => message(locale, key);
  const statusLabel = (status: string) => t(status === "Active" ? "workbench.material.active" : "workbench.material.blocked");
  const sortAriaLabel = (label: string, sortKey: string) => {
    const active = materialSortState?.key === sortKey;
    const state = active ? t(materialSortState?.direction === "asc" ? "workbench.table.ascending" : "workbench.table.descending") : "";
    return message(locale, "workbench.table.sortBy", { label, state });
  };

  return (
    <>
      <section className="card">
        <div className="inventory-toolbar">
          <div className="search-input-wrap">
            <SearchFieldIcon />
            <input
              value={materialSearchQuery}
              onChange={(event) => onMaterialSearchChange(event.target.value)}
              placeholder={t("workbench.material.searchPlaceholder")}
              aria-label={t("workbench.material.searchLabel")}
            />
          </div>
          <div className="category-wrap">
            <SelectFieldIcon />
            <select
              value={materialCategoryFilter}
              onChange={(event) => {
                onMaterialCategoryFilterChange(event.target.value);
              }}
              aria-label={t("workbench.material.categoryFilter")}
            >
              <option value="all">{t("workbench.material.allCategories")}</option>
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
              aria-label={t("workbench.material.subcategoryFilter")}
            >
              <option value="all">{t("workbench.material.allSubcategories")}</option>
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
          <h2>{t("workbench.material.title")}</h2>
          <div className="actions table-head-actions inventory-table-actions">
            {canManageCatalog ? (
              <button type="button" className="ghost-btn" disabled={busy || !isOrgScopedReady} onClick={onCreateMaterial}>
                {t("workbench.material.create")}
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
          <p>{t("workbench.material.noMatch")}</p>
        ) : (
          <div className="table-wrap">
            <table className={`compact-table ${styles.materialsTable}`}>
              <thead>
                <tr>
                  <SortableHeader tableId="materials" sortKey="sku" label={t("workbench.material.sku")} sortState={materialSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.material.sku"), "sku")} />
                  <SortableHeader tableId="materials" sortKey="name" label={t("workbench.material.name")} sortState={materialSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.material.name"), "name")} />
                  <SortableHeader tableId="materials" sortKey="category" label={t("workbench.material.category")} sortState={materialSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.material.category"), "category")} />
                  <SortableHeader tableId="materials" sortKey="subcategory" label={t("workbench.material.subcategory")} sortState={materialSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.material.subcategory"), "subcategory")} />
                  <SortableHeader tableId="materials" sortKey="description" label={t("workbench.material.description")} sortState={materialSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.material.description"), "description")} />
                  <SortableHeader tableId="materials" sortKey="uom" label={t("workbench.material.uom")} sortState={materialSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.material.uom"), "uom")} />
                  <SortableHeader tableId="materials" sortKey="minStock" label={t("workbench.material.minimumStock")} sortState={materialSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.material.minimumStock"), "minStock")} />
                  <SortableHeader tableId="materials" sortKey="status" label={t("workbench.location.status")} sortState={materialSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.location.status"), "status")} />
                  <SortableHeader tableId="materials" sortKey="createdAt" label={t("workbench.material.createdAt")} sortState={materialSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.material.createdAt"), "createdAt")} />
                  <th>
                    <span className="table-static-head">{t("workbench.location.actions")}</span>
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
                    <td>{statusLabel(row.status)}</td>
                    <td>{row.createdAt}</td>
                    <td>
                      {canManageCatalog ? (
                        <div className="row-actions table-action-buttons">
                          <button type="button" className="ghost-btn" disabled={busy} onClick={() => onEditMaterial(row.material)}>
                            {t("workbench.location.edit")}
                          </button>
                          <button type="button" className="ghost-btn" disabled={busy} onClick={() => onToggleMaterialUsage(row.material)}>
                            {row.material.is_active === false ? t("workbench.location.unblock") : t("workbench.location.block")}
                          </button>
                        </div>
                      ) : (
                        <span className="subtle-line">{t("workbench.location.noActions")}</span>
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
    </>
  );
}
