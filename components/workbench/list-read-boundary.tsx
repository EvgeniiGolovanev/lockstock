"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useLanguage } from "@/components/language-provider";
import { message } from "@/lib/i18n";
import type { ListLoadState } from "@/lib/ui/use-list-request";

const ListReady = createContext(true);
export const useListReady = () => useContext(ListReady);

export function ListReadBoundary({ state, enabled, onRetry, children }: {
  state: ListLoadState; enabled: boolean; onRetry: () => void; children: ReactNode;
}) {
  const { locale } = useLanguage();
  const ready = !enabled || state.phase === "ready";
  return <ListReady.Provider value={ready}>
    {!ready ? <div className="card" role={state.phase === "error" ? "alert" : "status"}>
      <p>{message(locale, state.phase === "error" ? "workbench.list.failed" : "workbench.list.loading")}</p>
      {state.hasData ? <p>{message(locale, "workbench.list.stale")}</p> : null}
      {state.phase === "error" ? <button type="button" onClick={onRetry}>{message(locale, "workbench.list.retry")}</button> : null}
    </div> : null}
    <div aria-busy={enabled && state.phase === "loading"}>{children}</div>
  </ListReady.Provider>;
}
