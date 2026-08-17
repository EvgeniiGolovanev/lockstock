"use client";

import { useEffect, useState } from "react";

import { useLanguage } from "@/components/language-provider";
import { message, type StaticMessageKey } from "@/lib/i18n";
import { type SortState } from "@/lib/ui/table-tools";

type SortableHeaderProps = {
  tableId: "movements";
  sortKey: string;
  label: string;
  sortState: SortState | undefined;
  onSort: (tableId: "movements", key: string) => void;
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

type MovementRow = {
  id: string;
  createdAt: string;
  materialLabel: string;
  locationLabel: string;
  quantity: string;
  uom: string;
  category: string;
  reason: string;
  comments: string;
};

type MaterialLookup = {
  id: string;
  sku: string;
  name: string;
};

type LocationLookup = {
  id: string;
  code?: string | null;
  name: string;
};

type StockMovementsSectionProps = {
  busy: boolean;
  canCreateStockMovement: boolean;
  canExportCsv: boolean;
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
  movementPage: number;
  movementTotalPages: number;
  movementFilterQuery: string;
  movementLocationFilter: string;
  movementReasonFilter: string;
  movementLocations: string[];
  movementReasons: string[];
  movementTableRows: MovementRow[];
  movementSortState: SortState | undefined;
  showMovementForm: boolean;
  activeMaterials: MaterialLookup[];
  activeLocations: LocationLookup[];
  onShowMovementFormChange: (value: boolean) => void;
  onMovementFilterQueryChange: (value: string) => void;
  onMovementLocationFilterChange: (value: string) => void;
  onMovementReasonFilterChange: (value: string) => void;
  onMovementPageChange: (updater: number | ((prev: number) => number)) => void;
  onExportCsv: () => void;
  onSort: (tableId: "movements", key: string) => void;
};

export function WorkbenchStockMovementsSection({
  busy,
  canCreateStockMovement,
  canExportCsv,
  apiRequest,
  onActivity,
  onBusyChange,
  onRefreshCoreData,
  movementPage,
  movementTotalPages,
  movementFilterQuery,
  movementLocationFilter,
  movementReasonFilter,
  movementLocations,
  movementReasons,
  movementTableRows,
  movementSortState,
  showMovementForm,
  activeMaterials,
  activeLocations,
  onShowMovementFormChange,
  onMovementFilterQueryChange,
  onMovementLocationFilterChange,
  onMovementReasonFilterChange,
  onMovementPageChange,
  onExportCsv,
  onSort
}: StockMovementsSectionProps) {
  const { locale } = useLanguage();
  const t = (key: StaticMessageKey) => message(locale, key);
  const sortAriaLabel = (label: string, sortKey: string) => {
    const active = movementSortState?.key === sortKey;
    const state = active ? t(movementSortState?.direction === "asc" ? "workbench.table.ascending" : "workbench.table.descending") : "";
    return message(locale, "workbench.table.sortBy", { label, state });
  };
  const reasonLabel = (reason: string) => {
    const key: Record<string, StaticMessageKey> = {
      Adjustment: "workbench.movement.adjustment", Consumption: "workbench.movement.consumption", Transfer: "workbench.movement.transfer",
      adjustment: "workbench.movement.adjustment", consumption: "workbench.movement.consumption", transfer: "workbench.movement.transfer"
    };
    return key[reason] ? t(key[reason]) : reason;
  };
  const [movementMaterialId, setMovementMaterialId] = useState("");
  const [movementReason, setMovementReason] = useState<"adjustment" | "consumption" | "transfer">("adjustment");
  const [movementLocationId, setMovementLocationId] = useState("");
  const [movementFromLocationId, setMovementFromLocationId] = useState("");
  const [movementToLocationId, setMovementToLocationId] = useState("");
  const [movementQuantity, setMovementQuantity] = useState(1);
  const [movementComment, setMovementComment] = useState("");

  useEffect(() => {
    if (!showMovementForm) {
      setMovementMaterialId("");
      setMovementReason("adjustment");
      setMovementLocationId("");
      setMovementFromLocationId("");
      setMovementToLocationId("");
      setMovementQuantity(1);
      setMovementComment("");
      return;
    }

    if (!movementMaterialId && activeMaterials[0]) {
      setMovementMaterialId(activeMaterials[0].id);
    }
    if (!movementLocationId && activeLocations[0]) {
      setMovementLocationId(activeLocations[0].id);
    }
    if (!movementFromLocationId && activeLocations[0]) {
      setMovementFromLocationId(activeLocations[0].id);
    }
    if (!movementToLocationId && activeLocations[0]) {
      const fallbackLocation = activeLocations.find((location) => location.id !== activeLocations[0].id) ?? activeLocations[0];
      setMovementToLocationId(fallbackLocation.id);
    }
  }, [activeLocations, activeMaterials, movementFromLocationId, movementLocationId, movementMaterialId, movementToLocationId, showMovementForm]);

  async function handleCreateMovement() {
    const trimmedComment = movementComment.trim();

    try {
      onBusyChange(true);

      if (!movementMaterialId) {
        onActivity("Create movement failed: material is required.");
        return false;
      }

      if (movementReason === "transfer") {
        if (!movementFromLocationId || !movementToLocationId) {
          onActivity("Create movement failed: source and destination locations are required.");
          return false;
        }
        if (movementFromLocationId === movementToLocationId) {
          onActivity("Create movement failed: transfer source and destination must differ.");
          return false;
        }
        if (Number(movementQuantity) <= 0) {
          onActivity("Create movement failed: transfer quantity must be positive.");
          return false;
        }
      } else if (!movementLocationId || Number(movementQuantity) === 0) {
        onActivity("Create movement failed: location and non-zero quantity are required.");
        return false;
      }

      await apiRequest("/api/stock/movements", {
        method: "POST",
        body:
          movementReason === "transfer"
            ? {
                material_id: movementMaterialId,
                from_location_id: movementFromLocationId,
                to_location_id: movementToLocationId,
                quantity: Math.abs(Number(movementQuantity)),
                reason: movementReason,
                note: trimmedComment || undefined
              }
            : {
                material_id: movementMaterialId,
                location_id: movementLocationId,
                quantity_delta: movementReason === "consumption" ? -Math.abs(Number(movementQuantity)) : Number(movementQuantity),
                reason: movementReason,
                note: trimmedComment || undefined
              }
      });

      onActivity("Movement created.");
      setMovementComment("");
      await onRefreshCoreData();
      return true;
    } catch (error) {
      onActivity(`Create movement failed: ${(error as Error).message}`);
      return false;
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <section className="card">
      <div className="inventory-toolbar materials-toolbar">
        <div className="search-input-wrap">
          <span className="field-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <path d="M10 4a6 6 0 1 0 3.87 10.63l4.75 4.75 1.41-1.41-4.75-4.75A6 6 0 0 0 10 4Zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
            </svg>
          </span>
          <input
            value={movementFilterQuery}
            onChange={(event) => onMovementFilterQueryChange(event.target.value)}
            placeholder={t("workbench.movement.searchPlaceholder")}
          />
        </div>
        <div className="category-wrap">
          <span className="field-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <path d="M7 10l5 5 5-5H7Z" />
            </svg>
          </span>
          <select
            value={movementLocationFilter}
            onChange={(event) => onMovementLocationFilterChange(event.target.value)}
          >
            {movementLocations.map((location) => (
              <option key={location} value={location}>
                {location === "all" ? t("workbench.movement.allLocations") : location}
              </option>
            ))}
          </select>
        </div>
        <div className="category-wrap">
          <span className="field-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <path d="M7 10l5 5 5-5H7Z" />
            </svg>
          </span>
          <select value={movementReasonFilter} onChange={(event) => onMovementReasonFilterChange(event.target.value)}>
            {movementReasons.map((reason) => (
              <option key={reason} value={reason}>
                {reason === "all" ? t("workbench.movement.allReasons") : reasonLabel(reason)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-section-head stock-movements-table-head">
        <h2>{t("workbench.movement.title")}</h2>
        <div className="actions table-head-actions inventory-table-actions">
          {canCreateStockMovement ? (
            <button type="button" className="ghost-btn" onClick={() => onShowMovementFormChange(true)}>
              {t("workbench.movement.open")}
            </button>
          ) : null}
          {canExportCsv ? (
            <button type="button" className="ghost-btn export-csv-btn" disabled={movementTableRows.length === 0} onClick={onExportCsv}>
              Export CSV
            </button>
          ) : null}
        </div>
      </div>

      {showMovementForm && canCreateStockMovement ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t("workbench.movement.open")}>
          <div className="modal-card">
            <div className="title-row">
              <div>
                <h4>{t("workbench.movement.open")}</h4>
                <p className="subtle-line">{t("workbench.movement.description")}</p>
              </div>
              <button type="button" className="ghost-btn" disabled={busy} onClick={() => onShowMovementFormChange(false)}>
                {t("common.close")}
              </button>
            </div>
            <div className="materials-form-wrap">
              <div className="stock-movement-form-grid">
                <div className="stock-movement-row stock-movement-row-top">
                  <label className="field">
                    <span>{t("workbench.movement.material")}</span>
                    <select value={movementMaterialId} onChange={(event) => setMovementMaterialId(event.target.value)}>
                      <option value="">{t("workbench.movement.selectMaterial")}</option>
                      {activeMaterials.map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.sku} - {material.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>{t("workbench.movement.reason")}</span>
                    <select
                      value={movementReason}
                      onChange={(event) => setMovementReason(event.target.value as "adjustment" | "consumption" | "transfer")}
                    >
                      <option value="adjustment">{t("workbench.movement.adjustment")}</option>
                      <option value="consumption">{t("workbench.movement.consumption")}</option>
                      <option value="transfer">{t("workbench.movement.transfer")}</option>
                    </select>
                  </label>
                </div>

                {movementReason !== "transfer" ? (
                  <div className="stock-movement-row stock-movement-row-single">
                    <label className="field">
                      <span>{t("workbench.movement.location")}</span>
                      <select value={movementLocationId} onChange={(event) => setMovementLocationId(event.target.value)}>
                        <option value="">{t("workbench.movement.selectLocation")}</option>
                        {activeLocations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.code ? `${location.code} - ` : ""}
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : (
                  <div className="stock-movement-row stock-movement-row-top">
                    <label className="field">
                      <span>{t("workbench.movement.transferOut")}</span>
                      <select value={movementFromLocationId} onChange={(event) => setMovementFromLocationId(event.target.value)}>
                        <option value="">{t("workbench.movement.selectLocation")}</option>
                        {activeLocations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.code ? `${location.code} - ` : ""}
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>{t("workbench.movement.transferTo")}</span>
                      <select value={movementToLocationId} onChange={(event) => setMovementToLocationId(event.target.value)}>
                        <option value="">{t("workbench.movement.selectLocation")}</option>
                        {activeLocations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.code ? `${location.code} - ` : ""}
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                <div className="stock-movement-row stock-movement-row-single">
                  <label className="field">
                    <span>{movementReason === "adjustment" ? t("workbench.movement.quantityDelta") : t("workbench.movement.quantity")}</span>
                    <input
                      type="number"
                      min={movementReason === "transfer" ? 1 : undefined}
                      max={movementReason === "consumption" ? -1 : undefined}
                      value={movementQuantity}
                      onChange={(event) => setMovementQuantity(Number(event.target.value))}
                    />
                  </label>
                </div>

                <div className="stock-movement-row stock-movement-row-single">
                  <label className="field">
                    <span>{t("workbench.movement.comments")}</span>
                    <textarea value={movementComment} onChange={(event) => setMovementComment(event.target.value)} rows={3} />
                  </label>
                </div>
              </div>
            </div>
            <div className="actions">
              <button type="button" disabled={busy} onClick={() => void handleCreateMovement()}>
                {movementReason === "consumption" ? t("workbench.movement.recordConsumption") : t("workbench.movement.addToStock")}
              </button>
              <button type="button" className="ghost-btn" disabled={busy} onClick={() => onShowMovementFormChange(false)}>
                {t("workbench.movement.cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {movementTableRows.length === 0 ? (
        <p>{t("workbench.movement.none")}</p>
      ) : (
        <div className="table-wrap">
          <table className="compact-table">
            <thead>
              <tr>
                <SortableHeader tableId="movements" sortKey="createdAt" label={t("workbench.movement.dateTime")} sortState={movementSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.movement.dateTime"), "createdAt")} />
                <SortableHeader tableId="movements" sortKey="materialLabel" label={t("workbench.movement.material")} sortState={movementSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.movement.material"), "materialLabel")} />
                <SortableHeader tableId="movements" sortKey="locationLabel" label={t("workbench.movement.location")} sortState={movementSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.movement.location"), "locationLabel")} />
                <SortableHeader tableId="movements" sortKey="quantity" label={t("workbench.movement.quantity")} sortState={movementSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.movement.quantity"), "quantity")} />
                <SortableHeader tableId="movements" sortKey="uom" label={t("workbench.material.uom")} sortState={movementSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.material.uom"), "uom")} />
                <SortableHeader tableId="movements" sortKey="category" label={t("workbench.material.category")} sortState={movementSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.material.category"), "category")} />
                <SortableHeader tableId="movements" sortKey="reason" label={t("workbench.movement.reason")} sortState={movementSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.movement.reason"), "reason")} />
                <SortableHeader tableId="movements" sortKey="comments" label={t("workbench.movement.comments")} sortState={movementSortState} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.movement.comments"), "comments")} />
              </tr>
            </thead>
            <tbody>
              {movementTableRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.createdAt}</td>
                  <td>{row.materialLabel}</td>
                  <td>{row.locationLabel}</td>
                  <td>{row.quantity}</td>
                  <td>{row.uom}</td>
                  <td>{row.category}</td>
                  <td>{reasonLabel(row.reason)}</td>
                  <td>{row.comments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="actions">
        <button type="button" disabled={busy || movementPage <= 1} onClick={() => onMovementPageChange((prev) => Math.max(1, prev - 1))}>
          {t("workbench.location.previous")}
        </button>
        <button type="button" disabled={busy || movementPage >= movementTotalPages} onClick={() => onMovementPageChange((prev) => Math.min(movementTotalPages, prev + 1))}>
          {t("workbench.location.next")}
        </button>
        <p className="subtle-line">{message(locale, "workbench.location.page", { page: String(movementPage), total: String(movementTotalPages) })}</p>
      </div>
    </section>
  );
}
