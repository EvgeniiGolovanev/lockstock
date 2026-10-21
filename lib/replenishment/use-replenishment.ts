"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { batchSchema, type DraftInput } from "@/lib/validators/replenishment";
import type { DraftResult, ReplenishmentList } from "./contracts";

export type ReplenishmentApi = <T>(path: string, options?: { method?: "GET" | "POST" | "PATCH"; body?: Record<string, unknown>; signal?: AbortSignal }) => Promise<T>;
export function useReplenishment(api: ReplenishmentApi, storageKey: string, requiredBy: string, timezone: string, view: string, page: number) {
  const [data, setData] = useState<ReplenishmentList | null>(null);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<DraftInput | null>(null); const [result, setResult] = useState<DraftResult | null>(null);
  const [revision, setRevision] = useState(0); const alive = useRef(true); const submitting = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    try { const text = localStorage.getItem(storageKey); if (text) { const parsed = batchSchema.safeParse(JSON.parse(text)); if (parsed.success) setPending(parsed.data); } } catch { /* Creation checks storage availability separately. */ }
  }, [storageKey]);
  useEffect(() => {
    const controller = new AbortController(); let current = true;
    setLoading(true); setError(""); setData(null);
    const query = new URLSearchParams({ required_by: requiredBy, timezone, state: view, page: String(page) });
    api<{ data: ReplenishmentList }>(`/api/replenishment?${query}`, { signal: controller.signal })
      .then(response => { if (current) setData(response.data); })
      .catch(err => { if (current) setError(err instanceof Error ? err.message : "Request failed"); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [api, requiredBy, timezone, view, page, revision]);
  const refresh = useCallback(() => setRevision(v => v+1), []);
  function complete(value: DraftResult) {
    localStorage.removeItem(storageKey);
    if (alive.current) { setResult(value); setPending(null); refresh(); }
  }
  async function submit(input: DraftInput) {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      // Do not send a mutation unless its identity can survive a reload.
      localStorage.setItem(storageKey, JSON.stringify(input)); setPending(input);
      const response = await api<{ data: DraftResult }>("/api/replenishment/drafts", { method: "POST", body: { ...input } });
      complete(response.data);
    } catch (err) {
      if (alive.current) {
        setError(err instanceof Error ? err.message : "Request failed");
        const status = (err as { status?: number }).status;
        if (status && [400, 403, 409].includes(status)) { localStorage.removeItem(storageKey); setPending(null); refresh(); }
      }
    } finally { submitting.current = false; if (alive.current) setBusy(false); }
  }
  async function check() {
    if (!pending || submitting.current) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      const response = await api<{ data: DraftResult }>(`/api/replenishment/requests/${pending.request_id}`);
      complete(response.data);
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : "Request failed"); }
    finally { submitting.current = false; if (alive.current) setBusy(false); }
  }
  return { data, error, loading, busy, pending, result, refresh, submit, check };
}
