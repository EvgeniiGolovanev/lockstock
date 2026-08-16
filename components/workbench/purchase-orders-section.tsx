"use client";

import type { Dispatch, SetStateAction } from "react";

import { formatDateLabel } from "@/lib/ui/formatters";
import { formatCurrencyAmount, formatCurrencyTotals, type PurchaseOrderCurrency, type PurchaseOrderOverview, type PurchaseOrderTableSummary } from "@/lib/ui/parity-models";
import { type SortState } from "@/lib/ui/table-tools";

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
  sortState: SortState | undefined;
  onSort: (tableId: "purchase-orders", key: string) => void;
};

function SortableHeader({ tableId, sortKey, label, sortState, onSort }: WorkbenchSortableHeaderProps) {
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

function formatPoStatusDetail(po: WorkbenchPurchaseOrder) {
  if (po.received_at) {
    return `Received ${formatDateLabel(po.received_at)}`;
  }
  if (po.sent_at) {
    return `Sent ${formatDateLabel(po.sent_at)}`;
  }
  if (po.status === "sent") {
    return "Sent";
  }
  if (po.status === "partial") {
    return "Receiving started";
  }
  if (po.status === "received") {
    return "Received";
  }
  if (po.status === "cancelled") {
    return "Cancelled";
  }
  return "Not sent";
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
  async function handleMarkPurchaseOrderSent(poId: string, poNumber: string) {
    try {
      onBusyChange(true);
      await apiRequest(`/api/purchase-orders/${poId}/status`, {
        method: "PATCH",
        body: {
          status: "sent"
        }
      });
      onActivity(`${poNumber} marked as sent.`);
      await onRefreshCoreData();
      return true;
    } catch (error) {
      onActivity(`Mark as sent failed: ${(error as Error).message}`);
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
      onActivity(`${purchaseOrder.po_number} cancelled.`);
      onPendingCancelPoChange(null);
      onSelectedPoDetailsIdChange((current) => (current === purchaseOrder.id ? null : current));
      await onRefreshCoreData();
      return true;
    } catch (error) {
      onActivity(`Cancel purchase order failed: ${(error as Error).message}`);
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
            <h3>Purchase Orders Status</h3>
          </div>
        </div>
        <div className="kpi-grid purchase-kpi-grid">
          <div className="kpi-card">
            <div className="kpi-top">
              <p>Total POs</p>
              <span className="kpi-dot kpi-blue" aria-hidden="true">
                PO
              </span>
            </div>
            <strong>{poTotal}</strong>
          </div>
          <div className="kpi-card">
            <div className="kpi-top">
              <p>Open Orders</p>
              <span className="kpi-dot kpi-amber" aria-hidden="true">
                OP
              </span>
            </div>
            <strong>{poOverview.openOrders}</strong>
          </div>
          <div className="kpi-card">
            <div className="kpi-top">
              <p>Received</p>
              <span className="kpi-dot kpi-green" aria-hidden="true">
                RC
              </span>
            </div>
            <strong>{poOverview.receivedOrders}</strong>
          </div>
          <div className="kpi-card">
            <div className="kpi-top">
              <p>Total Value</p>
              <span className="kpi-dot kpi-green" aria-hidden="true">
                TV
              </span>
            </div>
            <strong>{formatCurrencyTotals(poOverview.totalValueByCurrency)}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="purchase-toolbar">
          <div className="search-input-wrap">
            <SearchFieldIcon />
            <input
              value={poFilterQuery}
              onChange={(event) => {
                onPoFilterQueryChange(event.target.value);
              }}
              placeholder="Search by PO number..."
            />
          </div>
          <label className="field">
            <SelectFieldIcon />
            <select
              aria-label="Status"
              value={poFilterStatus}
              onChange={(event) => {
                onPoFilterStatusChange(event.target.value as PurchaseOrderFilterStatus);
              }}
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="partial">Partial</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="field">
            <SelectFieldIcon />
            <select
              aria-label="Supplier"
              value={poFilterSupplierId}
              onChange={(event) => {
                onPoFilterSupplierIdChange(event.target.value);
              }}
            >
              <option value="all">All suppliers</option>
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
          <h3>All Purchase Orders</h3>
          <div className="actions table-head-actions purchase-actions">
            {canReceivePurchaseOrders ? (
              <button type="button" className="ghost-btn" onClick={onOpenReceivePurchaseOrderForm}>
                Receive order
              </button>
            ) : null}
            {canManageCatalog ? (
              <button type="button" onClick={onOpenCreatePurchaseOrderForm}>
                Create PO
              </button>
            ) : null}
            {canExportCsv ? (
              <button type="button" className="ghost-btn export-csv-btn" disabled={purchaseOrderTableRows.length === 0} onClick={onExportCsv}>
                Export CSV
              </button>
            ) : null}
          </div>
        </div>
        {purchaseOrderTableRows.length === 0 ? (
          <div className="po-empty">
            <p>No purchase orders match these filters.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="compact-table purchase-orders-table">
              <thead>
                <tr>
                  <SortableHeader tableId="purchase-orders" sortKey="poNumber" label="PO Number" sortState={tableSortState} onSort={onSort} />
                  <SortableHeader tableId="purchase-orders" sortKey="supplier" label="Supplier" sortState={tableSortState} onSort={onSort} />
                  <SortableHeader tableId="purchase-orders" sortKey="status" label="Status" sortState={tableSortState} onSort={onSort} />
                  <SortableHeader tableId="purchase-orders" sortKey="lines" label="Lines" sortState={tableSortState} onSort={onSort} />
                  <SortableHeader tableId="purchase-orders" sortKey="progress" label="Progress" sortState={tableSortState} onSort={onSort} />
                  <SortableHeader tableId="purchase-orders" sortKey="total" label="Total" sortState={tableSortState} onSort={onSort} />
                  <SortableHeader tableId="purchase-orders" sortKey="expected" label="Expected" sortState={tableSortState} onSort={onSort} />
                  <th>
                    <span className="table-static-head">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrderTableRows.map(({ po, summary }) => {
                  const canReceive = canReceivePurchaseOrders && (po.status === "sent" || po.status === "partial");
                  const canMarkSent = canManageCatalog && po.status === "draft";
                  const canCancel = canManageCatalog && (po.status === "draft" || po.status === "sent" || po.status === "partial");
                  return (
                    <tr key={po.id} className="po-row" title="Double-click to view all line items" onDoubleClick={() => onSelectedPoDetailsIdChange(po.id)}>
                      <td>
                        <div className="po-cell-main">{po.po_number}</div>
                        <div className="po-cell-subtle">Created {formatDateLabel(po.created_at)}</div>
                      </td>
                      <td>
                        <div className="po-cell-main">{summary.supplierLabel}</div>
                        <div className="po-cell-subtle">{summary.linePreview}</div>
                      </td>
                      <td>
                        <span className={`status-pill status-${po.status}`}>{po.status.toUpperCase()}</span>
                        <div className="po-cell-subtle">{formatPoStatusDetail(po)}</div>
                      </td>
                      <td>
                        <div className="po-cell-main">
                          {summary.lineCount} {summary.lineCount === 1 ? "line" : "lines"}
                        </div>
                        <div className="po-cell-subtle">
                          {summary.totalReceived} received / {summary.totalOrdered} ordered
                        </div>
                      </td>
                      <td>
                        <div className="po-cell-main">
                          {summary.totalReceived}/{summary.totalOrdered} ({summary.progressPercentage}%)
                        </div>
                        <div className="progress-track" aria-label={`received progress for ${po.po_number}`}>
                          <span className="progress-fill" style={{ width: `${summary.progressPercentage}%` }} />
                        </div>
                      </td>
                      <td>
                        <div className="po-cell-main">{formatCurrencyAmount(summary.totalAmount, summary.currency)}</div>
                      </td>
                      <td>
                        <div className="po-cell-main">{formatDateLabel(po.expected_at)}</div>
                        <div className="po-cell-subtle">{po.expected_at ? "Expected arrival" : "No expected date"}</div>
                      </td>
                      <td onDoubleClick={(event) => event.stopPropagation()}>
                        <div className="row-actions">
                          {canMarkSent ? (
                            <button
                              type="button"
                              disabled={busy}
                              className="ghost-btn po-receive-btn"
                              onClick={() => {
                                void handleMarkPurchaseOrderSent(po.id, po.po_number);
                              }}
                            >
                              Mark Sent
                            </button>
                          ) : null}
                          {canReceive ? (
                            <button
                              type="button"
                              disabled={busy || summary.lineCount === 0}
                              className="ghost-btn po-receive-btn"
                              onClick={() => {
                                onPrepareReceivePurchaseOrder(po.id, po.lines[0]?.id ?? "");
                              }}
                            >
                              Receive
                            </button>
                          ) : null}
                          {canCancel ? (
                            <button
                              type="button"
                              disabled={busy}
                              className="ghost-btn danger-btn po-receive-btn"
                              onClick={() => onPendingCancelPoChange(po)}
                            >
                              Cancel
                            </button>
                          ) : null}
                          {!canCancel && !canReceive ? <span className="po-cell-subtle">No actions</span> : null}
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
            Previous
          </button>
          <button type="button" disabled={busy || poPage >= poTotalPages} onClick={() => onPoPageChange((prev) => Math.min(poTotalPages, prev + 1))}>
            Next
          </button>
          <p className="subtle-line">Page {poPage}/{poTotalPages}</p>
        </div>
      </section>

      {selectedPoDetails ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Purchase order ${selectedPoDetails.po_number}`}>
          <div className="modal-card po-modal-card">
            <div className="title-row po-modal-head">
              <div>
                <h4>{selectedPoDetails.po_number}</h4>
                <p className="po-modal-subtitle">
                  {selectedPoDetails.supplier?.name ?? "Unknown supplier"} | {formatPoStatusDetail(selectedPoDetails)}
                </p>
              </div>
              <button type="button" className="ghost-btn po-modal-close" onClick={() => onSelectedPoDetailsIdChange(null)}>
                x
              </button>
            </div>
            <div className="po-modal-body">
              <section className="po-modal-section">
                <div className="po-detail-summary">
                  <div>
                    <p className="po-meta-label">Status</p>
                    <p className="po-meta-value">
                      <span className={`status-pill status-${selectedPoDetails.status}`}>{selectedPoDetails.status.toUpperCase()}</span>
                    </p>
                  </div>
                  <div>
                    <p className="po-meta-label">Created</p>
                    <p className="po-meta-value">{formatDateLabel(selectedPoDetails.created_at)}</p>
                  </div>
                  <div>
                    <p className="po-meta-label">Sent</p>
                    <p className="po-meta-value">{formatDateLabel(selectedPoDetails.sent_at)}</p>
                  </div>
                  <div>
                    <p className="po-meta-label">Expected</p>
                    <p className="po-meta-value">{formatDateLabel(selectedPoDetails.expected_at)}</p>
                  </div>
                </div>
              </section>

              <section className="po-modal-section">
                <h5>Line Items</h5>
                {selectedPoDetails.lines.length > 0 ? (
                  <div className="po-draft-lines-wrap">
                    <table className="po-lines-table">
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th>UoM</th>
                          <th>Ordered</th>
                          <th>Received</th>
                          <th>Remaining</th>
                          <th>Unit Price</th>
                          <th>Total</th>
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
                  <p className="po-line-empty">No line items found for this purchase order.</p>
                )}
              </section>
            </div>
            <div className="actions po-modal-footer">
              <button type="button" className="ghost-btn" disabled={busy} onClick={() => onSelectedPoDetailsIdChange(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingCancelPo ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm purchase order cancellation">
          <div className="modal-card">
            <div className="title-row">
              <h4>Cancel Purchase Order</h4>
              <button type="button" className="ghost-btn po-modal-close" onClick={() => onPendingCancelPoChange(null)}>
                x
              </button>
            </div>
            <p className="subtle-line">Cancel {pendingCancelPo.po_number}? This will stop receiving against this purchase order.</p>
            <div className="actions">
              <button type="button" className="ghost-btn" disabled={busy} onClick={() => onPendingCancelPoChange(null)}>
                Keep PO
              </button>
              <button type="button" className="danger-btn" disabled={busy} onClick={() => void handleConfirmCancelPurchaseOrder(pendingCancelPo)}>
                Cancel PO
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
