"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { browserApiRequest } from "@/lib/api/browser-request";
import { useListRequest } from "./use-list-request";

type AuditEntry = { id: string; actor_user_id: string | null; action: string; entity_type: string; entity_label: string | null; message: string; metadata: unknown; created_at: string };

export function useAccountAudit({ accountKey, orgId, enabled, refresh, canExport, from, to }: {
  accountKey: string; orgId: string; enabled: boolean; refresh: number; canExport: boolean; from: string; to: string;
}) {
  const scope = JSON.stringify([accountKey, orgId, enabled]);
  const { request: reads, state } = useListRequest(scope);
  const { request: exports, state: exportState } = useListRequest(scope, JSON.stringify([from, to, canExport]));
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [exportAttempt, setExportAttempt] = useState<typeof exports | null>(null);
  useLayoutEffect(() => { setRows([]); }, [scope]);

  const retry = useCallback(async () => {
    if (!enabled) return;
    try {
      await reads.run(() => browserApiRequest<{ data: AuditEntry[] }>("/api/audit-log", { orgId }), response => setRows(response.data ?? []));
    } catch { /* The current request exposes safe feedback through state. */ }
  }, [enabled, orgId, reads]);
  useEffect(() => { void retry(); }, [retry, refresh]);

  const exportPhase = exportAttempt === exports ? exportState.phase : "idle";
  async function download() {
    if (!enabled || !canExport || !from || !to || exportPhase === "loading") return;
    setExportAttempt(exports);
    const params = new URLSearchParams({ format: "csv", from, to });
    try {
      await exports.run(() => browserApiRequest<Blob>(`/api/audit-log?${params}`, { orgId, responseType: "blob" }), blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        try {
          link.href = url; link.download = `audit-log-${from}-${to}.csv`;
          document.body.append(link); link.click();
        } finally { link.remove(); URL.revokeObjectURL(url); }
      });
    } catch { /* Obsolete downloads cannot commit or replace current feedback. */ }
  }
  return { rows, state, retry, download, exportPhase };
}
