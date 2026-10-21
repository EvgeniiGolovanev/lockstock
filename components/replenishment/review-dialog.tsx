"use client";
import { useState } from "react";
import { AccessibilityDialog } from "@/components/accessibility-dialog";
import { batchSchema, type DraftInput } from "@/lib/validators/replenishment";
import type { ReplenishmentRow } from "@/lib/replenishment/contracts";
import { replenishmentCopy } from "./copy";
import styles from "./replenishment.module.css";
export function ReviewDialog({ rows, previous, supplierNames, locale, requiredBy, timezone, busy, onClose, onSubmit }: {
  rows: ReplenishmentRow[]; previous?: DraftInput | null; supplierNames: Record<string,string>; locale: "en" | "fr"; requiredBy: string; timezone: string; busy: boolean; onClose: () => void; onSubmit: (input: DraftInput) => void;
}) {
  const t = replenishmentCopy[locale];
  const [edits, setEdits] = useState(() => rows.map(r => {
    const prior = previous?.rows.find(e => e.material_id===r.material_id);
    const sameCurrency = prior?.currency===r.currency;
    return { material_id: r.material_id, supplier_id: r.supplier_id!, currency: r.currency as "EUR" | "USD", snapshot_token: r.snapshot_token,
      quantity: prior && Number(prior.quantity)<=Number(r.suggested_order) ? prior.quantity : r.suggested_order,
      unit_price: prior && sameCurrency ? prior.unit_price ?? null : r.unit_price,
      expected_at: prior?.supplier_id===r.supplier_id ? prior.expected_at ?? null : null,
      acknowledge_incoming: false };
  }));
  const input = { request_id: "00000000-0000-4000-8000-000000000000", required_by: requiredBy, timezone, rows: edits };
  const valid = batchSchema.safeParse(input).success && edits.every((e, i) => Number(e.quantity) <= Number(rows[i].suggested_order) && (!rows[i].uncertain || e.acknowledge_incoming));
  const groups = Array.from(new Set(edits.map(e => `${e.supplier_id}:${e.currency}`)));
  function edit(index: number, patch: Partial<(typeof edits)[number]>) { setEdits(old => old.map((e, i) => i === index ? { ...e, ...patch } : e)); }
  const dateConflict = groups.some(g => new Set(edits.filter(e => `${e.supplier_id}:${e.currency}` === g).map(e => e.expected_at)).size > 1);
  return <AccessibilityDialog title={t.reviewOrders} onClose={() => { if (!busy) onClose(); }} closeLabel={t.close} closeAriaLabel={t.close}>
    <p>{t.notice}</p>
    {previous ? <p>{t.changed}</p> : null}
    {groups.map(g => { const selected = edits.filter(e => `${e.supplier_id}:${e.currency}` === g); return <div key={g}><h3>{supplierNames[selected[0].supplier_id] ?? selected[0].supplier_id}</h3><p>{selected[0].currency} · {t.subtotal}: {selected.reduce((sum, e) => sum+Number(e.quantity)*Number(e.unit_price ?? 0), 0).toFixed(2)} {selected.some(e => e.unit_price === null) ? `· ${t.unknown}` : ""}</p></div>; })}
    {rows.map((r, index) => <fieldset key={r.material_id} className={styles.reviewRow}><legend>{r.sku} · {r.name} ({r.uom}) · {edits[index].currency}</legend>
      <label>{t.quantity}<input aria-label={`${t.quantity} ${r.sku}`} type="number" step="0.001" min="0.001" max={r.suggested_order} value={edits[index].quantity} onChange={e => edit(index,{ quantity: e.target.value })} /></label>
      <label>{t.price}<input aria-label={`${t.price} ${r.sku}`} type="number" step="0.01" min="0" value={edits[index].unit_price ?? ""} placeholder={t.noPrice} onChange={e => edit(index,{ unit_price: e.target.value || null })} /></label>
      {edits[index].unit_price === null ? <span>{t.noPrice}</span> : null}
      <label>{t.expected}<input aria-label={`${t.expected} ${r.sku}`} type="date" value={edits[index].expected_at ?? ""} onChange={e => edit(index,{ expected_at: e.target.value || null })} /></label>
      {r.uncertain ? <label className={styles.warning}><input type="checkbox" checked={edits[index].acknowledge_incoming} onChange={e => edit(index,{ acknowledge_incoming: e.target.checked })} />{t.ack}</label> : null}
    </fieldset>)}
    {dateConflict ? <p role="alert">{locale === "fr" ? "Utilisez une date par fournisseur et devise." : "Use one expected date per supplier and currency."}</p> : null}
    <button type="button" disabled={!valid || dateConflict || busy} onClick={() => onSubmit({ ...input, request_id: crypto.randomUUID() })}>{t.create}</button>
  </AccessibilityDialog>;
}
