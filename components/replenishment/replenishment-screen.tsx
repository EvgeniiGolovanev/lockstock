"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AccessibilityDialog } from "@/components/accessibility-dialog";
import { useReplenishment, type ReplenishmentApi } from "@/lib/replenishment/use-replenishment";
import type { DraftInput } from "@/lib/validators/replenishment";
import type { ReplenishmentRow } from "@/lib/replenishment/contracts";
import { replenishmentCopy } from "./copy";
import { ReviewDialog } from "./review-dialog";
import styles from "./replenishment.module.css";
type Supplier = { id: string; name: string; is_active: boolean };
function initialDate() { const date = new Date(); date.setDate(date.getDate()+14); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
export function ReplenishmentScreen({ orgId, accountKey, apiRequest, canManage: roleCanManage, locale }: { orgId: string; accountKey: string; apiRequest: ReplenishmentApi; canManage: boolean; locale: "en" | "fr" }) {
  const t = replenishmentCopy[locale];
  const [requiredBy, setRequiredBy] = useState(initialDate); const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [view, setView] = useState("all"); const [page, setPage] = useState(1);
  const storageKey = `lockstock.replenishment:${accountKey}:${orgId}`;
  const state = useReplenishment(apiRequest, storageKey, requiredBy, timezone, view, page);
  const canManage = roleCanManage && state.data?.can_write !== false;
  const [selected, setSelected] = useState<string[]>([]); const [review, setReview] = useState<ReplenishmentRow[] | null>(null);
  const [previous, setPrevious] = useState<DraftInput | null>(null);
  const [currency, setCurrency] = useState("EUR");
  useEffect(() => { if (state.result) { setSelected([]); setPrevious(null); } }, [state.result]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]); const [supplierError, setSupplierError] = useState("");
  const [editing, setEditing] = useState<ReplenishmentRow | null>(null); const [minimum, setMinimum] = useState(""); const [target, setTarget] = useState(""); const [supplier, setSupplier] = useState(""); const [saving, setSaving] = useState(false); const [settingError, setSettingError] = useState("");
  useEffect(() => {
    let alive = true; const controller = new AbortController();
    async function load() {
      const collected: Supplier[] = []; let p = 1; let total = 1;
      do { const response = await apiRequest<{ data: Supplier[]; meta?: { total_pages: number } }>(`/api/suppliers?page=${p}&limit=100`, { signal: controller.signal }); collected.push(...response.data); total = response.meta?.total_pages ?? 1; p++; } while(p<=total && !controller.signal.aborted);
      if (alive) setSuppliers(collected.filter(s => s.is_active));
    }
    void load().catch(error => { if (alive) setSupplierError(error instanceof Error ? error.message : t.error); });
    return () => { alive=false; controller.abort(); };
  }, [apiRequest, t.error]);
  async function save() {
    if (!editing || saving) return;
    setSaving(true); setSettingError("");
    try { await apiRequest("/api/replenishment/settings", { method: "PATCH", body: { material_id: editing.material_id, min_stock: minimum, target_stock: target || null, supplier_id: supplier || null, currency } }); setEditing(null); setSelected([]); state.refresh(); }
    catch (error) { setSettingError(error instanceof Error ? error.message : t.error); }
    finally { setSaving(false); }
  }
  function refresh() { setSelected([]); setReview(null); state.refresh(); }
  return <>
    <section className="card">
    <div className={styles.filters}>
      <label className="field"><span>{t.date}</span><input type="date" value={requiredBy} disabled={state.busy || !!state.pending} onChange={e => { setRequiredBy(e.target.value); setPage(1); setSelected([]); setReview(null); }} /></label>
      <label className="field"><span>{t.state}</span><select value={view} onChange={e => { setView(e.target.value); setPage(1); setSelected([]); }}><option value="all">{t.all}</option>{(["ready","review","setup","draft","covered"] as const).map(s => <option key={s} value={s}>{t[s]} ({state.data?.counts[s] ?? 0})</option>)}</select></label>

    </div>
    <p className="subtle-line">{t.scope} · {t.scopeNote}</p>
    </section>
    <section className={`card ${styles.root}`} aria-label={t.title}>
    <div className="title-row"><h3>{t.plan}</h3><div className="actions table-head-actions">
      <button type="button" className="ghost-btn" onClick={refresh} disabled={state.busy}>{t.refresh}</button>
      <button type="button" disabled={!canManage || !selected.length || !!state.pending || state.busy || state.loading} onClick={() => setReview((state.data?.rows ?? []).filter(r => selected.includes(r.material_id) && Number(r.suggested_order)>0).sort((a,b) => `${a.supplier_id}:${a.currency}`.localeCompare(`${b.supplier_id}:${b.currency}`)))}>{t.reviewOrders}</button>
    </div></div>
    {!canManage ? <p className="subtle-line">{t.readOnly}</p> : null}
    {state.pending ? <div role="status" className={styles.warning}><p>{t.pending}</p><button type="button" disabled={state.busy} onClick={() => void state.check()}>{t.check}</button> <button type="button" disabled={state.busy || !canManage} onClick={() => void state.submit(state.pending!)}>{t.retryRequest}</button></div> : null}
    {state.result ? <div role="status" className={styles.success}><strong>{t.created}</strong>{state.result.orders.map(po => <p key={po.id}><Link href={`/purchase-orders?order=${po.id}&q=${encodeURIComponent(po.po_number)}`}>{po.po_number}</Link> · {po.currency}</p>)}</div> : null}
    {state.error || supplierError ? <div role="alert" className={styles.error}>{state.error || supplierError}<button type="button" onClick={refresh}>{t.retry}</button></div> : null}
    {state.loading ? <p role="status">{t.loading}</p> : state.data?.rows.length === 0 ? <p>{t.empty}</p> : null}
    {state.data && !state.loading ? <><div className={`table-wrap ${styles.tableScroll}`}><table className="compact-table" aria-label={t.plan}><thead><tr><th scope="col">{t.select}</th><th scope="col">{t.material}</th><th scope="col">{t.onHand}</th><th scope="col">{t.minimum} / {t.target}</th><th scope="col">{t.incoming}</th><th scope="col">{t.planned}</th><th scope="col">{t.suggested}</th><th scope="col">{t.supplier}</th><th scope="col">{t.settings}</th></tr></thead><tbody>
      {state.data.rows.map(r => <tr key={r.material_id}>
        <td><input aria-label={`${t.select} ${r.sku}`} type="checkbox" checked={selected.includes(r.material_id)} disabled={!canManage || !r.supplier_id || !["EUR","USD"].includes(r.currency ?? "") || Number(r.suggested_order)<=0 || !!state.pending} onChange={e => setSelected(old => e.target.checked ? [...old,r.material_id] : old.filter(id => id!==r.material_id))} /></td>
        <td><strong>{r.name}</strong><div className={styles.materialMeta}>{r.sku} · {r.uom}</div><span className={`status-pill ${r.state === "ready" || r.state === "covered" ? "status-in-stock" : r.state === "draft" ? "status-draft" : "status-low-stock"}`}>{t[r.state]}</span><details><summary>{t.explain}</summary><p>{t.formula}</p><p>{r.target_stock} − {r.on_hand} − {r.confirmed_incoming} − {r.draft_planned} = {r.suggested_order}</p>{r.orders.map((o,i) => <p key={`${o.id}:${i}`}><Link href={`/purchase-orders?order=${o.id}&q=${encodeURIComponent(o.number)}`}>{o.number}</Link> · {o.status} · {o.remaining} · {o.expected_at ?? "—"}</p>)}{r.uncertain ? <p className={styles.warning}>{t.warning}</p> : null}{r.draft_warning ? <p className={styles.warning}>{t.draftWarning}</p> : null}</details></td>
        <td className={styles.quantity}>{r.on_hand}</td><td className={styles.quantity}>{r.min_stock} / {r.target_stock}</td><td className={styles.quantity}>{r.confirmed_incoming}</td><td className={styles.quantity}>{r.draft_planned}</td><td className={styles.quantity}><strong>{r.suggested_order}</strong></td><td>{suppliers.find(s => s.id===r.supplier_id)?.name ?? "—"}</td>
        <td><button type="button" className="ghost-btn" disabled={!canManage || !!state.pending || state.busy} onClick={() => { setEditing(r); setMinimum(r.min_stock); setTarget(r.target_stock); setSupplier(r.supplier_id ?? ""); setCurrency(r.currency === "USD" ? "USD" : "EUR"); setSettingError(""); }}>{t.settings}</button></td>
      </tr>)}
    </tbody></table></div><div className={styles.pagination}><button type="button" className="ghost-btn" disabled={page<=1} onClick={() => { setPage(p=>p-1); setSelected([]); }}>{t.previous}</button><span>{page} / {Math.max(1,Math.ceil(state.data.total/50))}</span><button type="button" className="ghost-btn" disabled={page*50>=state.data.total} onClick={() => { setPage(p=>p+1); setSelected([]); }}>{t.next}</button></div></> : null}
    {review ? <ReviewDialog rows={review} previous={previous} supplierNames={Object.fromEntries(suppliers.map(s => [s.id,s.name]))} locale={locale} requiredBy={requiredBy} timezone={timezone} busy={state.busy || !!state.pending} onClose={() => setReview(null)} onSubmit={input => { setPrevious(input); setReview(null); void state.submit(input); }} /> : null}
    {editing ? <AccessibilityDialog title={`${t.settings} · ${editing.sku}`} onClose={() => { if (!saving) setEditing(null); }} closeLabel={t.close} closeAriaLabel={t.close}>
      <div className={styles.settingsGrid}><label className="field"><span>{t.minimum}</span><input type="number" min="0" step="0.001" value={minimum} onChange={e=>setMinimum(e.target.value)} /></label><label className="field"><span>{t.target}</span><input type="number" min={minimum} step="0.001" value={target} onChange={e=>setTarget(e.target.value)} /></label><label className="field"><span>{t.supplier}</span><select value={supplier} onChange={e=>setSupplier(e.target.value)}><option value="">{t.none}</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
      <label className="field"><span>{t.currency}</span><select value={currency} onChange={e=>setCurrency(e.target.value)}><option value="EUR">EUR</option><option value="USD">USD</option></select></label>
      {settingError ? <p role="alert" className={styles.error}>{settingError}</p> : null}<div className={styles.dialogActions}><button type="button" disabled={saving || !canManage || minimum==="" || (target!=="" && Number(target)<Number(minimum))} onClick={()=>void save()}>{t.save}</button></div>
    </AccessibilityDialog> : null}
  </section></>;
}
