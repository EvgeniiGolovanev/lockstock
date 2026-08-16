"use client";

import { useEffect, useMemo, useState } from "react";

import type { PurchaseOrderCurrency } from "@/lib/ui/parity-models";
import { currencySymbol, formatCurrencyAmount } from "@/lib/ui/parity-models";

type PurchaseOrderDraftLine = {
  id: string;
  material_id: string;
  quantity_ordered: number;
  unit_price: number | null;
};

type PurchaseOrderLine = {
  id: string;
  material_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number | null;
};

type PurchaseOrder = {
  id: string;
  po_number: string;
  status: "draft" | "sent" | "partial" | "received" | "cancelled";
  supplier: { id: string; name: string } | null;
  lines: PurchaseOrderLine[];
};

type MaterialLookup = {
  id: string;
  sku: string;
  name: string;
  uom: string;
};

type LocationLookup = {
  id: string;
  code?: string | null;
  name: string;
};

type PurchaseOrderFormsProps = {
  busy: boolean;
  isOrgScopedReady: boolean;
  canManageCatalog: boolean;
  canReceivePurchaseOrders: boolean;
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
  showPoCreateForm: boolean;
  showPoReceiveForm: boolean;
  activeSuppliers: Array<{ id: string; name: string }>;
  activeMaterials: MaterialLookup[];
  purchaseOrders: PurchaseOrder[];
  activeLocations: LocationLookup[];
  initialReceivePoId: string;
  initialReceivePoLineId: string;
  onClosePoCreateForm: () => void;
  onClosePoReceiveForm: () => void;
};

export function WorkbenchPurchaseOrderForms({
  busy,
  isOrgScopedReady,
  canManageCatalog,
  canReceivePurchaseOrders,
  apiRequest,
  onActivity,
  onBusyChange,
  onRefreshCoreData,
  showPoCreateForm,
  showPoReceiveForm,
  activeSuppliers,
  activeMaterials,
  purchaseOrders,
  activeLocations,
  initialReceivePoId,
  initialReceivePoLineId,
  onClosePoCreateForm,
  onClosePoReceiveForm,
}: PurchaseOrderFormsProps) {
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poCurrency, setPoCurrency] = useState<PurchaseOrderCurrency>("EUR");
  const [poExpectedAt, setPoExpectedAt] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [poMaterialId, setPoMaterialId] = useState("");
  const [poQuantityOrdered, setPoQuantityOrdered] = useState(1);
  const [poUnitPrice, setPoUnitPrice] = useState(0);
  const [poDraftLines, setPoDraftLines] = useState<PurchaseOrderDraftLine[]>([]);
  const [receivePoId, setReceivePoId] = useState("");
  const [receivePoLineId, setReceivePoLineId] = useState("");
  const [receiveLocationId, setReceiveLocationId] = useState("");
  const [receiveQuantity, setReceiveQuantity] = useState(1);

  useEffect(() => {
    if (!showPoCreateForm) {
      setPoSupplierId("");
      setPoCurrency("EUR");
      setPoExpectedAt("");
      setPoNotes("");
      setPoMaterialId("");
      setPoQuantityOrdered(1);
      setPoUnitPrice(0);
      setPoDraftLines([]);
    }
  }, [showPoCreateForm]);

  useEffect(() => {
    if (!showPoReceiveForm) {
      setReceivePoId("");
      setReceivePoLineId("");
      setReceiveLocationId("");
      setReceiveQuantity(1);
    }
  }, [showPoReceiveForm]);

  useEffect(() => {
    if (!showPoReceiveForm) {
      return;
    }

    setReceivePoId(initialReceivePoId);
    setReceivePoLineId(initialReceivePoLineId);
  }, [initialReceivePoId, initialReceivePoLineId, showPoReceiveForm]);

  const selectedPurchaseOrder = useMemo(() => purchaseOrders.find((po) => po.id === receivePoId) ?? null, [purchaseOrders, receivePoId]);
  const selectedReceiveLine = useMemo(
    () => selectedPurchaseOrder?.lines.find((line) => line.id === receivePoLineId) ?? null,
    [receivePoLineId, selectedPurchaseOrder]
  );
  const selectedReceiveMaterial = useMemo(
    () => (selectedReceiveLine ? activeMaterials.find((item) => item.id === selectedReceiveLine.material_id) ?? null : null),
    [activeMaterials, selectedReceiveLine]
  );
  const poDraftSummary = useMemo(() => {
    const lineCount = poDraftLines.length;
    const totalAmount = poDraftLines.reduce((sum, line) => sum + Number(line.quantity_ordered || 0) * Number(line.unit_price || 0), 0);
    return {
      lineCount,
      totalAmount,
      currency: poCurrency
    };
  }, [poCurrency, poDraftLines]);

  function handleAddPoDraftLine() {
    if (!poMaterialId || poQuantityOrdered <= 0) {
      return;
    }

    setPoDraftLines((current) => [
      ...current,
      {
        id: `${poMaterialId}-${Date.now()}`,
        material_id: poMaterialId,
        quantity_ordered: Number(poQuantityOrdered),
        unit_price: poUnitPrice > 0 ? Number(poUnitPrice) : null
      }
    ]);
    setPoMaterialId("");
    setPoQuantityOrdered(1);
    setPoUnitPrice(0);
  }

  function handleRemovePoDraftLine(lineId: string) {
    setPoDraftLines((current) => current.filter((line) => line.id !== lineId));
  }

  function closeCreateForm() {
    setPoSupplierId("");
    setPoCurrency("EUR");
    setPoExpectedAt("");
    setPoNotes("");
    setPoMaterialId("");
    setPoQuantityOrdered(1);
    setPoUnitPrice(0);
    setPoDraftLines([]);
    onClosePoCreateForm();
  }

  function closeReceiveForm() {
    setReceivePoId("");
    setReceivePoLineId("");
    setReceiveLocationId("");
    setReceiveQuantity(1);
    onClosePoReceiveForm();
  }

  async function handleCreatePurchaseOrder() {
    try {
      onBusyChange(true);
      const lines =
        poDraftLines.length > 0
          ? poDraftLines.map((line) => ({
              material_id: line.material_id,
              quantity_ordered: Number(line.quantity_ordered),
              unit_price: line.unit_price ?? undefined
            }))
          : poMaterialId && poQuantityOrdered > 0
            ? [
                {
                  material_id: poMaterialId,
                  quantity_ordered: Number(poQuantityOrdered),
                  unit_price: poUnitPrice > 0 ? Number(poUnitPrice) : undefined
                }
              ]
            : [];

      if (!poSupplierId || lines.length === 0) {
        onActivity("Create purchase order failed: supplier and at least one line are required.");
        return false;
      }

      await apiRequest("/api/purchase-orders", {
        method: "POST",
        body: {
          supplier_id: poSupplierId,
          currency: poCurrency,
          expected_at: poExpectedAt || undefined,
          notes: poNotes.trim() || undefined,
          lines
        }
      });
      onActivity("Purchase order created.");
      closeCreateForm();
      await onRefreshCoreData();
      return true;
    } catch (error) {
      onActivity(`Create purchase order failed: ${(error as Error).message}`);
      return false;
    } finally {
      onBusyChange(false);
    }
  }

  async function handleReceivePurchaseOrder() {
    try {
      onBusyChange(true);
      await apiRequest(`/api/purchase-orders/${receivePoId}/receive`, {
        method: "POST",
        body: {
          receipts: [
            {
              po_line_id: receivePoLineId,
              location_id: receiveLocationId,
              quantity_received: Number(receiveQuantity)
            }
          ]
        }
      });
      onActivity("Purchase order receipt recorded.");
      closeReceiveForm();
      await onRefreshCoreData();
      return true;
    } catch (error) {
      onActivity(`Receive purchase order failed: ${(error as Error).message}`);
      return false;
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <>
      {showPoCreateForm && canManageCatalog ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Create purchase order">
          <div className="modal-card po-modal-card">
            <div className="title-row po-modal-head">
              <h4>Create Purchase Order</h4>
              <button type="button" className="ghost-btn po-modal-close" onClick={onClosePoCreateForm}>
                x
              </button>
            </div>
            <div className="po-modal-body">
              <section className="po-modal-section">
                <h5>Basic Info</h5>
                <div className="grid grid-2">
                  <label className="field">
                    <span>Supplier</span>
                    <select value={poSupplierId} onChange={(event) => setPoSupplierId(event.target.value)}>
                      <option value="">Select supplier</option>
                      {activeSuppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Currency</span>
                    <select value={poCurrency} onChange={(event) => setPoCurrency(event.target.value as PurchaseOrderCurrency)}>
                      <option value="EUR">Euro (€)</option>
                      <option value="USD">US Dollar ($)</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Expected Date</span>
                    <input type="date" value={poExpectedAt} onChange={(event) => setPoExpectedAt(event.target.value)} />
                  </label>
                  <label className="field po-modal-span-2">
                    <span>Notes (optional)</span>
                    <textarea rows={3} value={poNotes} onChange={(event) => setPoNotes(event.target.value)} placeholder="Additional instructions" />
                  </label>
                </div>
              </section>

              <section className="po-modal-section">
                <h5>Add Items</h5>
                <div className="po-item-grid">
                  <label className="field">
                    <span>Material</span>
                    <select value={poMaterialId} onChange={(event) => setPoMaterialId(event.target.value)}>
                      <option value="">Select material</option>
                      {activeMaterials.map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.sku} - {material.name} ({material.uom})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Quantity</span>
                    <input type="number" min={0.001} step="0.001" value={poQuantityOrdered} onChange={(event) => setPoQuantityOrdered(Number(event.target.value))} />
                  </label>
                  <label className="field">
                    <span>Unit Price ({currencySymbol(poCurrency)})</span>
                    <input type="number" min={0} step="0.01" value={poUnitPrice} onChange={(event) => setPoUnitPrice(Number(event.target.value))} />
                  </label>
                  <div className="actions po-item-action">
                    <button type="button" disabled={busy || !poMaterialId || poQuantityOrdered <= 0} onClick={handleAddPoDraftLine}>
                      Add Item
                    </button>
                  </div>
                </div>

                {poDraftLines.length > 0 ? (
                  <div className="po-draft-lines-wrap">
                    <table className="po-lines-table">
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th>UoM</th>
                          <th>Quantity</th>
                          <th>Unit Price</th>
                          <th>Total</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {poDraftLines.map((line) => {
                          const material = activeMaterials.find((item) => item.id === line.material_id);
                          const lineTotal = Number(line.quantity_ordered || 0) * Number(line.unit_price || 0);
                          return (
                            <tr key={line.id}>
                              <td>{material ? `${material.sku} - ${material.name}` : "Unknown material"}</td>
                              <td>{material?.uom ?? "-"}</td>
                              <td>{line.quantity_ordered}</td>
                              <td>{formatCurrencyAmount(Number(line.unit_price || 0), poCurrency)}</td>
                              <td>{formatCurrencyAmount(lineTotal, poCurrency)}</td>
                              <td>
                                <button type="button" className="ghost-btn po-line-remove" onClick={() => handleRemovePoDraftLine(line.id)}>
                                  Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="po-line-empty">No items added yet.</p>
                )}

                <p className="po-draft-summary">
                  {poDraftSummary.lineCount} {poDraftSummary.lineCount === 1 ? "material" : "materials"} -{" "}
                  {formatCurrencyAmount(poDraftSummary.totalAmount, poCurrency)}
                </p>
              </section>
            </div>
            <div className="actions po-modal-footer">
                <button type="button" className="ghost-btn" disabled={busy} onClick={closeCreateForm}>
                Cancel
              </button>
                <button
                  type="button"
                  disabled={busy || !isOrgScopedReady || !poSupplierId || poDraftLines.length === 0}
                  onClick={() => void handleCreatePurchaseOrder()}
                >
                  Create Purchase Order
                </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPoReceiveForm && canReceivePurchaseOrders ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Receive purchase order">
          <div className="modal-card po-modal-card">
            <div className="title-row po-modal-head">
              <h4>Receive Purchase Order</h4>
              <button type="button" className="ghost-btn po-modal-close" onClick={onClosePoReceiveForm}>
                x
              </button>
            </div>
            <div className="po-modal-body">
              <section className="po-modal-section">
                <h5>Receipt Details</h5>
                <div className="grid grid-2">
                  <label className="field">
                    <span>Purchase Order</span>
                    <select value={receivePoId} onChange={(event) => setReceivePoId(event.target.value)}>
                      <option value="">Select purchase order</option>
                      {purchaseOrders
                        .filter((po) => po.status !== "received" && po.status !== "cancelled")
                        .map((po) => (
                          <option key={po.id} value={po.id}>
                            {po.po_number} - {po.supplier?.name ?? "Unknown"} ({po.status})
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Line</span>
                    <select value={receivePoLineId} onChange={(event) => setReceivePoLineId(event.target.value)}>
                      <option value="">Select line</option>
                      {(selectedPurchaseOrder?.lines ?? []).map((line) => {
                        const material = activeMaterials.find((item) => item.id === line.material_id);
                        return (
                          <option key={line.id} value={line.id}>
                            {(material?.sku ?? "Material")} | ordered {line.quantity_ordered} | received {line.quantity_received}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <label className="field">
                    <span>Location</span>
                    <select value={receiveLocationId} onChange={(event) => setReceiveLocationId(event.target.value)}>
                      <option value="">Select location</option>
                      {(activeLocations ?? []).map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.code ? `${location.code} - ` : ""}
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Quantity Received</span>
                    <input type="number" min={0.001} step="0.001" value={receiveQuantity} onChange={(event) => setReceiveQuantity(Number(event.target.value))} />
                  </label>
                </div>
              </section>

              <section className="po-modal-section">
                <h5>Selected Line</h5>
                {selectedReceiveLine ? (
                  <div className="po-receive-summary">
                    <div>
                      <p className="po-meta-label">Material</p>
                      <p className="po-meta-value">
                        {selectedReceiveMaterial ? `${selectedReceiveMaterial.sku} - ${selectedReceiveMaterial.name}` : selectedReceiveLine.material_id}
                      </p>
                    </div>
                    <div>
                      <p className="po-meta-label">Ordered</p>
                      <p className="po-meta-value">{selectedReceiveLine.quantity_ordered}</p>
                    </div>
                    <div>
                      <p className="po-meta-label">Already Received</p>
                      <p className="po-meta-value">{selectedReceiveLine.quantity_received}</p>
                    </div>
                    <div>
                      <p className="po-meta-label">Remaining</p>
                      <p className="po-meta-value">
                        {Math.max(0, Number(selectedReceiveLine.quantity_ordered || 0) - Number(selectedReceiveLine.quantity_received || 0))}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="po-line-empty">Select a purchase order line to review receipt details.</p>
                )}
              </section>
            </div>
            <div className="actions po-modal-footer">
              <button type="button" className="ghost-btn" disabled={busy} onClick={closeReceiveForm}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !isOrgScopedReady || !receivePoId || !receivePoLineId || !receiveLocationId || receiveQuantity <= 0}
                onClick={() => void handleReceivePurchaseOrder()}
              >
                Receive
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
