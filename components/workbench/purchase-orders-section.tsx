"use client";

import type { Dispatch, SetStateAction } from "react";

import { useLanguage } from "@/components/language-provider";
import { message, type StaticMessageKey } from "@/lib/i18n";
import { formatDateLabel } from "@/lib/ui/formatters";
import { formatCurrencyAmount, formatCurrencyTotals, type PurchaseOrderCurrency, type PurchaseOrderOverview, type PurchaseOrderTableSummary } from "@/lib/ui/parity-models";
import { type SortState } from "@/lib/ui/table-tools";
import styles from "./purchase-orders-section.module.css";
import poStyles from "./purchase-order-shared.module.css";

type WorkbenchPurchaseOrderLine = {
  id: string;
  material_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number | null;
};

type WorkbenchPurchaseOrder = {
  id: string;
  po_number: string;
  status: "draft" | "sent" | "partial" | "received" | "cancelled";
  currency: PurchaseOrderCurrency;
  expected_at?: string | null;
  sent_at?: string | null;
  received_at?: string | null;
  created_at?: string;
  supplier: { id: string; name: string } | null;
  lines: WorkbenchPurchaseOrderLine[];
};

type WorkbenchPurchaseOrderTableRow = {
  po: WorkbenchPurchaseOrder;
  summary: PurchaseOrderTableSummary;
};

type WorkbenchMaterialLookup = {
  id: string;
  sku: string;
  name: string;
  uom: string;
};

type WorkbenchSortableHeaderProps = {
  tableId: "purchase-orders";
  sortKey: string;
  label: string;
  sortAriaLabel: string;
  sortState: SortState | undefined;
  onSort: (tableId: "purchase-orders", key: string) => void;
};

function SortableHeader({ tableId, sortKey, label, sortAriaLabel, sortState, onSort }: WorkbenchSortableHeaderProps) {
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

function SearchFieldIcon() {
  return (
    <span className="field-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M10 4a6 6 0 1 0 3.87 10.63l4.75 4.75 1.41-1.41-4.75-4.75A6 6 0 0 0 10 4Zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
      </svg>
    </span>
  );
}

function SelectFieldIcon() {
  return (
    <span className="field-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M7 10l5 5 5-5H7Z" />
      </svg>
    </span>
  );
}

type PurchaseOrderFilterStatus = "all" | WorkbenchPurchaseOrder["status"];

type WorkbenchPurchaseOrdersSectionProps = {
  busy: boolean;
  canManageCatalog: boolean;
  canReceivePurchaseOrders: boolean;
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
  poTotal: number;
  poPage: number;
  poTotalPages: number;
  poOverview: PurchaseOrderOverview;
  poFilterQuery: string;
  poFilterStatus: PurchaseOrderFilterStatus;
  poFilterSupplierId: string;
  suppliers: Array<{ id: string; name: string }>;
  purchaseOrderTableRows: WorkbenchPurchaseOrderTableRow[];
  selectedPoDetails: WorkbenchPurchaseOrder | null;
  pendingCancelPo: WorkbenchPurchaseOrder | null;
  materials: WorkbenchMaterialLookup[];
  tableSortState: SortState | undefined;
  onOpenCreatePurchaseOrderForm: () => void;
  onOpenReceivePurchaseOrderForm: () => void;
  onPrepareReceivePurchaseOrder: (poId: string, lineId: string) => void;
  onSelectedPoDetailsIdChange: Dispatch<SetStateAction<string | null>>;
  onPendingCancelPoChange: Dispatch<SetStateAction<WorkbenchPurchaseOrder | null>>;
  onPoFilterQueryChange: (value: string) => void;
  onPoFilterStatusChange: (value: PurchaseOrderFilterStatus) => void;
  onPoFilterSupplierIdChange: (value: string) => void;
  onPoPageChange: Dispatch<SetStateAction<number>>;
  onExportCsv: () => void;
  onSort: (tableId: "purchase-orders", key: string) => void;
};

function formatPoStatusDetail(po: WorkbenchPurchaseOrder, locale: "en" | "fr") {
  if (po.received_at) {
    return message(locale, "workbench.po.receivedOn", { date: formatDateLabel(po.received_at) });
  }
  if (po.sent_at) {
    return message(locale, "workbench.po.sentOn", { date: formatDateLabel(po.sent_at) });
  }
  if (po.status === "sent") {
    return message(locale, "workbench.po.sent");
  }
  if (po.status === "partial") {
    return message(locale, "workbench.po.receivingStarted");
  }
  if (po.status === "received") {
    return message(locale, "workbench.po.received");
  }
  if (po.status === "cancelled") {
    return message(locale, "workbench.po.cancelled");
  }
  return message(locale, "workbench.po.notSent");
}

export function WorkbenchPurchaseOrdersSection({
  busy,
  canManageCatalog,
  canReceivePurchaseOrders,
  canExportCsv,
  apiRequest,
  onActivity,
  onBusyChange,
  onRefreshCoreData,
  poTotal,
  poPage,
  poTotalPages,
  poOverview,
  poFilterQuery,
  poFilterStatus,
  poFilterSupplierId,
  suppliers,
  purchaseOrderTableRows,
  selectedPoDetails,
  pendingCancelPo,
  materials,
  tableSortState,
  onOpenCreatePurchaseOrderForm,
  onOpenReceivePurchaseOrderForm,
  onPrepareReceivePurchaseOrder,
  onSelectedPoDetailsIdChange,
  onPendingCancelPoChange,
  onPoFilterQueryChange,
  onPoFilterStatusChange,
  onPoFilterSupplierIdChange,
  onPoPageChange,
  onExportCsv,
  onSort
}: WorkbenchPurchaseOrdersSectionProps) {
  const { locale } = useLanguage();
  const t = (key: StaticMessageKey) => message(locale, key);
  const sortAriaLabel = (label: string, sortKey: string) => {
    const active = tableSortState?.key === sortKey;
    const direction = tableSortState?.direction === "asc" ? "ascending" : "descending";
    return message(locale, "workbench.table.sortBy", { label, state: active ? `, ${direction}` : "" });
  };
  async function handleMarkPurchaseOrderSent(poId: string, poNumber: string) {
    try {
      onBusyChange(true);
      await apiRequest(`/api/purchase-orders/${poId}/status`, {
        method: "PATCH",
        body: {
          status: "sent"
        }
      });
      onActivity(message(locale, "workbench.po.activitySent", { number: poNumber }));
      await onRefreshCoreData();
      return true;
    } catch (error) {
      onActivity(message(locale, "workbench.po.activitySentFailed", { reason: (error as Error).message }));
      return false;
    } finally {
      onBusyChange(false);
    }
  }

  async function handleConfirmCancelPurchaseOrder(purchaseOrder: WorkbenchPurchaseOrder) {
    try {
      onBusyChange(true);
      await apiRequest(`/api/purchase-orders/${purchaseOrder.id}/status`, {
        method: "PATCH",
        body: {
          status: "cancelled"
        }
      });
      onActivity(message(locale, "workbench.po.activityCancelled", { number: purchaseOrder.po_number }));
      onPendingCancelPoChange(null);
      onSelectedPoDetailsIdChange((current) => (current === purchaseOrder.id ? null : current));
      await onRefreshCoreData();
      return true;
    } catch (error) {
      onActivity(message(locale, "workbench.po.activityCancelledFailed", { reason: (error as Error).message }));
      return false;
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <>
      <section className="card">
        <div className="title-row">
          <div>
            <h3>{t("workbench.po.statusTitle")}</h3>
          </div>
        </div>
        <div className={`kpi-grid ${styles.kpiGrid}`}>
          <div className="kpi-card">
            <div className="kpi-top">
              <p>{t("workbench.po.total")}</p>
              <span className="kpi-dot kpi-blue" aria-hidden="true">
                PO
              </span>
            </div>
            <strong>{poTotal}</strong>
          </div>
          <div className="kpi-card">
            <div className="kpi-top">
              <p>{t("workbench.po.open")}</p>
              <span className="kpi-dot kpi-amber" aria-hidden="true">
                OP
              </span>
            </div>
            <strong>{poOverview.openOrders}</strong>
          </div>
          <div className="kpi-card">
            <div className="kpi-top">
              <p>{t("workbench.po.received")}</p>
              <span className="kpi-dot kpi-green" aria-hidden="true">
                RC
              </span>
            </div>
            <strong>{poOverview.receivedOrders}</strong>
          </div>
          <div className="kpi-card">
            <div className="kpi-top">
              <p>{t("workbench.snapshot.totalValue")}</p>
              <span className="kpi-dot kpi-green" aria-hidden="true">
                TV
              </span>
            </div>
            <strong>{formatCurrencyTotals(poOverview.totalValueByCurrency)}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <div className={styles.toolbar}>
          <div className="search-input-wrap">
            <SearchFieldIcon />
            <input
              value={poFilterQuery}
              onChange={(event) => {
                onPoFilterQueryChange(event.target.value);
              }}
              placeholder={t("workbench.po.search")}
            />
          </div>
          <label className="field">
            <SelectFieldIcon />
            <select
              aria-label={t("workbench.location.status")}
              value={poFilterStatus}
              onChange={(event) => {
                onPoFilterStatusChange(event.target.value as PurchaseOrderFilterStatus);
              }}
            >
              <option value="all">{t("workbench.po.allStatuses")}</option>
              <option value="draft">{t("workbench.po.draft")}</option>
              <option value="sent">{t("workbench.po.sent")}</option>
              <option value="partial">{t("workbench.po.partial")}</option>
              <option value="received">{t("workbench.po.received")}</option>
              <option value="cancelled">{t("workbench.po.cancelled")}</option>
            </select>
          </label>
          <label className="field">
            <SelectFieldIcon />
            <select
              aria-label={t("workbench.po.supplier")}
              value={poFilterSupplierId}
              onChange={(event) => {
                onPoFilterSupplierIdChange(event.target.value);
              }}
            >
              <option value="all">{t("workbench.po.allSuppliers")}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="card">
        <div className="title-row">
          <h3>{t("workbench.po.all")}</h3>
          <div className={`actions table-head-actions ${styles.tableActions}`}>
            {canReceivePurchaseOrders ? (
              <button type="button" className="ghost-btn" onClick={onOpenReceivePurchaseOrderForm}>
                {t("workbench.po.receiveOrder")}
              </button>
            ) : null}
            {canManageCatalog ? (
              <button type="button" onClick={onOpenCreatePurchaseOrderForm}>
                {t("workbench.po.create")}
              </button>
            ) : null}
            {canExportCsv ? (
              <button type="button" className="ghost-btn export-csv-btn" disabled={purchaseOrderTableRows.length === 0} onClick={onExportCsv}>
                {t("workbench.location.exportCsv")}
              </button>
            ) : null}
          </div>
        </div>
        {purchaseOrderTableRows.length === 0 ? (
          <div className={styles.empty}>
            <p>{t("workbench.po.empty")}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className={`compact-table ${styles.table}`}>
              <thead>
                <tr>
                  <SortableHeader tableId="purchase-orders" sortKey="poNumber" label={t("workbench.po.number")} sortAriaLabel={sortAriaLabel(t("workbench.po.number"), "poNumber")} sortState={tableSortState} onSort={onSort} />
                  <SortableHeader tableId="purchase-orders" sortKey="supplier" label={t("workbench.po.supplier")} sortAriaLabel={sortAriaLabel(t("workbench.po.supplier"), "supplier")} sortState={tableSortState} onSort={onSort} />
                  <SortableHeader tableId="purchase-orders" sortKey="status" label={t("workbench.location.status")} sortAriaLabel={sortAriaLabel(t("workbench.location.status"), "status")} sortState={tableSortState} onSort={onSort} />
                  <SortableHeader tableId="purchase-orders" sortKey="lines" label={t("workbench.po.lines")} sortAriaLabel={sortAriaLabel(t("workbench.po.lines"), "lines")} sortState={tableSortState} onSort={onSort} />
                  <SortableHeader tableId="purchase-orders" sortKey="progress" label={t("workbench.po.progress")} sortAriaLabel={sortAriaLabel(t("workbench.po.progress"), "progress")} sortState={tableSortState} onSort={onSort} />
                  <SortableHeader tableId="purchase-orders" sortKey="total" label={t("workbench.snapshot.totalValue")} sortAriaLabel={sortAriaLabel(t("workbench.snapshot.totalValue"), "total")} sortState={tableSortState} onSort={onSort} />
                  <SortableHeader tableId="purchase-orders" sortKey="expected" label={t("workbench.po.expected")} sortAriaLabel={sortAriaLabel(t("workbench.po.expected"), "expected")} sortState={tableSortState} onSort={onSort} />
                  <th>
                    <span className="table-static-head">{t("workbench.po.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrderTableRows.map(({ po, summary }) => {
                  const canReceive = canReceivePurchaseOrders && (po.status === "sent" || po.status === "partial");
                  const canMarkSent = canManageCatalog && po.status === "draft";
                  const canCancel = canManageCatalog && (po.status === "draft" || po.status === "sent" || po.status === "partial");
                  return (
                    <tr key={po.id} className={styles.row} title={t("workbench.po.doubleClickDetails")} onDoubleClick={() => onSelectedPoDetailsIdChange(po.id)}>
                      <td>
                        <div className={styles.cellMain}>{po.po_number}</div>
                        <div className={styles.cellSubtle}>{message(locale, "workbench.po.createdOn", { date: formatDateLabel(po.created_at) })}</div>
                      </td>
                      <td>
                        <div className={styles.cellMain}>{summary.supplierLabel}</div>
                        <div className={styles.cellSubtle}>{summary.linePreview}</div>
                      </td>
                      <td>
                        <span className={`status-pill status-${po.status}`}>{po.status.toUpperCase()}</span>
                        <div className={styles.cellSubtle}>{formatPoStatusDetail(po, locale)}</div>
                      </td>
                      <td>
                        <div className={styles.cellMain}>
                          {summary.lineCount} {summary.lineCount === 1 ? t("workbench.po.line") : t("workbench.po.linesPlural")}
                        </div>
                        <div className={styles.cellSubtle}>
                          {message(locale, "workbench.po.lineSummary", { received: String(summary.totalReceived), ordered: String(summary.totalOrdered) })}
                        </div>
                      </td>
                      <td>
                        <div className={styles.cellMain}>
                          {summary.totalReceived}/{summary.totalOrdered} ({summary.progressPercentage}%)
                        </div>
                        <div className="progress-track" aria-label={message(locale, "workbench.po.progressAria", { number: po.po_number })}>
                          <span className="progress-fill" style={{ width: `${summary.progressPercentage}%` }} />
                        </div>
                      </td>
                      <td>
                        <div className={styles.cellMain}>{formatCurrencyAmount(summary.totalAmount, summary.currency)}</div>
                      </td>
                      <td>
                        <div className={styles.cellMain}>{formatDateLabel(po.expected_at)}</div>
                        <div className={styles.cellSubtle}>{po.expected_at ? t("workbench.po.expectedArrival") : t("workbench.po.noExpectedDate")}</div>
                      </td>
                      <td onDoubleClick={(event) => event.stopPropagation()}>
                        <div className={`row-actions ${styles.rowActions}`}>
                          {canMarkSent ? (
                            <button
                              type="button"
                              disabled={busy}
                              className={`ghost-btn ${styles.receiveButton}`}
                              onClick={() => {
                                void handleMarkPurchaseOrderSent(po.id, po.po_number);
                              }}
                            >
                              {t("workbench.po.markSent")}
                            </button>
                          ) : null}
                          {canReceive ? (
                            <button
                              type="button"
                              disabled={busy || summary.lineCount === 0}
                              className={`ghost-btn ${styles.receiveButton}`}
                              onClick={() => {
                                onPrepareReceivePurchaseOrder(po.id, po.lines[0]?.id ?? "");
                              }}
                            >
                              {t("workbench.po.receive")}
                            </button>
                          ) : null}
                          {canCancel ? (
                            <button
                              type="button"
                              disabled={busy}
                              className={`ghost-btn danger-btn ${styles.receiveButton}`}
                              onClick={() => onPendingCancelPoChange(po)}
                            >
                              {t("workbench.po.cancel")}
                            </button>
                          ) : null}
                          {!canCancel && !canReceive ? <span className={styles.cellSubtle}>{t("workbench.po.noActions")}</span> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="actions">
          <button type="button" disabled={busy || poPage <= 1} onClick={() => onPoPageChange((prev) => Math.max(1, prev - 1))}>
            {t("workbench.po.previous")}
          </button>
          <button type="button" disabled={busy || poPage >= poTotalPages} onClick={() => onPoPageChange((prev) => Math.min(poTotalPages, prev + 1))}>
            {t("workbench.po.next")}
          </button>
          <p className="subtle-line">{message(locale, "workbench.po.page", { page: String(poPage), total: String(poTotalPages) })}</p>
        </div>
      </section>

      {selectedPoDetails ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={message(locale, "workbench.po.detailsAria", { number: selectedPoDetails.po_number })}>
          <div className={`modal-card ${poStyles.modalCard}`}>
            <div className={`title-row ${poStyles.modalHead}`}>
              <div>
                <h4>{selectedPoDetails.po_number}</h4>
                <p className={poStyles.modalSubtitle}>
                  {selectedPoDetails.supplier?.name ?? t("workbench.po.unknownSupplier")} | {formatPoStatusDetail(selectedPoDetails, locale)}
                </p>
              </div>
              <button type="button" className={`ghost-btn ${poStyles.modalClose}`} onClick={() => onSelectedPoDetailsIdChange(null)}>
                x
              </button>
            </div>
            <div className={poStyles.modalBody}>
              <section className={poStyles.modalSection}>
                <div className={poStyles.detailSummary}>
                  <div>
                    <p className={poStyles.metaLabel}>{t("workbench.location.status")}</p>
                    <p className={poStyles.metaValue}>
                      <span className={`status-pill status-${selectedPoDetails.status}`}>{selectedPoDetails.status.toUpperCase()}</span>
                    </p>
                  </div>
                  <div>
                    <p className={poStyles.metaLabel}>{t("workbench.po.created")}</p>
                    <p className={poStyles.metaValue}>{formatDateLabel(selectedPoDetails.created_at)}</p>
                  </div>
                  <div>
                    <p className={poStyles.metaLabel}>{t("workbench.po.sent")}</p>
                    <p className={poStyles.metaValue}>{formatDateLabel(selectedPoDetails.sent_at)}</p>
                  </div>
                  <div>
                    <p className={poStyles.metaLabel}>{t("workbench.po.expected")}</p>
                    <p className={poStyles.metaValue}>{formatDateLabel(selectedPoDetails.expected_at)}</p>
                  </div>
                </div>
              </section>

              <section className={poStyles.modalSection}>
                <h5>{t("workbench.po.lineItems")}</h5>
                {selectedPoDetails.lines.length > 0 ? (
                  <div className={poStyles.draftLinesWrap}>
                    <table className={poStyles.linesTable}>
                      <thead>
                        <tr>
                          <th>{t("workbench.po.material")}</th>
                          <th>{t("workbench.po.uom")}</th>
                          <th>{t("workbench.po.ordered")}</th>
                          <th>{t("workbench.po.received")}</th>
                          <th>{t("workbench.po.remaining")}</th>
                          <th>{t("workbench.po.unitPrice")}</th>
                          <th>{t("workbench.snapshot.totalValue")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPoDetails.lines.map((line) => {
                          const quantityOrdered = Number(line.quantity_ordered || 0);
                          const quantityReceived = Number(line.quantity_received || 0);
                          const unitPrice = Number(line.unit_price || 0);
                          return (
                            <tr key={line.id}>
                              {(() => {
                                const material = materials.find((item) => item.id === line.material_id);
                                return (
                                  <>
                                    <td>{material ? `${material.sku} - ${material.name}` : line.material_id}</td>
                                    <td>{material?.uom ?? "-"}</td>
                                  </>
                                );
                              })()}
                              <td>{quantityOrdered}</td>
                              <td>{quantityReceived}</td>
                              <td>{Math.max(0, quantityOrdered - quantityReceived)}</td>
                              <td>{formatCurrencyAmount(unitPrice, selectedPoDetails.currency)}</td>
                              <td>{formatCurrencyAmount(quantityOrdered * unitPrice, selectedPoDetails.currency)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className={poStyles.lineEmpty}>{t("workbench.po.emptyLines")}</p>
                )}
              </section>
            </div>
            <div className={`actions ${poStyles.modalFooter}`}>
              <button type="button" className="ghost-btn" disabled={busy} onClick={() => onSelectedPoDetailsIdChange(null)}>
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingCancelPo ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t("workbench.po.cancelDialogAria")}>
          <div className="modal-card">
            <div className="title-row">
              <h4>{t("workbench.po.cancelTitle")}</h4>
              <button type="button" className={`ghost-btn ${poStyles.modalClose}`} onClick={() => onPendingCancelPoChange(null)}>
                x
              </button>
            </div>
            <p className="subtle-line">{message(locale, "workbench.po.cancelConfirm", { number: pendingCancelPo.po_number })}</p>
            <div className="actions">
              <button type="button" className="ghost-btn" disabled={busy} onClick={() => onPendingCancelPoChange(null)}>
                {t("workbench.po.keep")}
              </button>
              <button type="button" className="danger-btn" disabled={busy} onClick={() => void handleConfirmCancelPurchaseOrder(pendingCancelPo)}>
                {t("workbench.po.cancelPo")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
