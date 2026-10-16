"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { useLatestRequest } from "./use-latest-request";

export type ListLoadState = { phase: "loading" | "ready" | "error"; hasData: boolean };

function createListRequest(gate: ReturnType<typeof useLatestRequest>, onUpdate: (phase: ListLoadState["phase"]) => void) {
  let active = false, generation = 0, sequence = 0;
  return {
    activate() { active = true; generation++; },
    invalidate() { active = false; generation++; },
    async run<T>(read: () => Promise<T>, commit: (data: T) => void, current: () => boolean = () => true): Promise<T> {
      const startedFor = generation, id = ++sequence;
      const latest = () => active && startedFor === generation && id === sequence;
      const update = (phase: ListLoadState["phase"]) => {
        if (latest()) onUpdate(phase);
      };
      try {
        return await gate.run(() => { update("loading"); return read(); }, data => {
          commit(data); update("ready");
        }, current);
      } catch (error) {
        // An enclosing failed batch may invalidate this read without starting
        // a successor. Stop its spinner as well; obsolete generations cannot.
        update("error");
        throw error;
      }
    }
  };
}

// Keep read state separate from mutation recovery. Retrying this request never
// replays a write or clears a form's committed-operation guard.
export function useListRequest(scope: string, query = "") {
  const key = JSON.stringify([scope, query]);
  const gate = useLatestRequest(key);
  const scopeIdentity = useMemo(() => ({ scope }), [scope]);
  const [stored, setStored] = useState<ListLoadState & { scope: typeof scopeIdentity; gate: typeof gate }>({ scope: scopeIdentity, gate, phase: "loading", hasData: false });
  const request = useMemo(() => createListRequest(gate, phase => {
    setStored(previous => ({ scope: scopeIdentity, gate, phase, hasData: phase === "ready" || (previous.scope === scopeIdentity && previous.hasData) }));
  }), [gate, scopeIdentity]);
  useLayoutEffect(() => { request.activate(); return () => request.invalidate(); }, [request]);
  const state: ListLoadState = stored.gate === gate ? stored : { phase: "loading", hasData: stored.scope === scopeIdentity && stored.hasData };
  return { request, state };
}
