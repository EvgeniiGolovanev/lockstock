"use client";

import { useLayoutEffect, useMemo } from "react";

export class SupersededRequest extends Error {
  constructor() { super("Request superseded."); }
}

export function isSupersededRequest(error: unknown) {
  return error instanceof SupersededRequest;
}

// A gate belongs to one rendered account/workspace/query. Old callbacks retain
// their invalidated gate, so they cannot start a request that supersedes new work.
function createRequestGate(key: string) {
  let active = false, generation = 0, sequence = 0;
  function begin() {
    const startedFor = generation, request = ++sequence;
    return () => active && generation === startedFor && sequence === request;
  }
  return {
    key,
    activate() { active = true; generation++; },
    invalidate() { active = false; generation++; },
    begin,
    async run<T>(read: () => Promise<T>, commit: (data: T) => void, current: () => boolean = () => true): Promise<T> {
      const latest = begin();
      if (!latest() || !current()) throw new SupersededRequest();
      let data: T;
      try { data = await read(); }
      catch (error) {
        if (!latest() || !current()) throw new SupersededRequest();
        throw error;
      }
      if (!latest() || !current()) throw new SupersededRequest();
      commit(data);
      return data;
    }
  };
}

export function useLatestRequest(key: string) {
  const gate = useMemo(() => createRequestGate(key), [key]);
  useLayoutEffect(() => { gate.activate(); return () => gate.invalidate(); }, [gate]);
  return gate;
}
