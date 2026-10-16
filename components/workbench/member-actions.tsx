"use client";

import { useEffect, useRef, useState } from "react";
import { message, type Locale } from "@/lib/i18n";
import styles from "./members-section.module.css";

export type MemberAction = "rename" | "invite" | "accept" | "reject" | "remove" | "leave" | "members" | "groups" | "invitations";

export function useMemberActions({ scope, locale, onBusyChange }: {
  scope: string; locale: Locale; onBusyChange: (busy: boolean) => void;
}) {
  const [action, setAction] = useState<MemberAction>("members");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const pending = useRef(false);
  const recovery = useRef<null | { read: () => Promise<void>; committed: boolean }>(null);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    if (pending.current) onBusyChange(false);
    recovery.current = null; pending.current = false;
    setError(null); setNotice(null); setBlocked(false);
  }, [scope, onBusyChange]);

  async function recover(read: () => Promise<void>, committed: boolean) {
    const startedFor = generation.current;
    try {
      await read();
      if (generation.current !== startedFor) return;
      recovery.current = null; setBlocked(false); setError(null);
    } catch {
      if (generation.current !== startedFor) return;
      recovery.current = { read, committed }; setBlocked(true);
      setError(message(locale, committed ? "workbench.catalog.refreshFailed" : "workbench.members.readFailed"));
    }
  }
  async function retry() {
    if (pending.current || !recovery.current) return;
    pending.current = true; onBusyChange(true);
    const startedFor = generation.current;
    try { await recover(recovery.current.read, recovery.current.committed); }
    finally { if (generation.current === startedFor) { pending.current = false; onBusyChange(false); } }
  }
  async function run<T>(nextAction: MemberAction, write: () => Promise<T>, read: (data: T, isCurrent: () => boolean) => Promise<void>, saved?: (data: T) => void) {
    if (pending.current || recovery.current) return;
    pending.current = true; onBusyChange(true);
    setAction(nextAction); setError(null); setNotice(null);
    const startedFor = generation.current;
    try {
      let data: T;
      try { data = await write(); }
      catch (failure) {
        if (generation.current === startedFor) setError(failure instanceof Error && failure.message.trim() ? failure.message : message(locale, "workbench.catalog.unexpectedError"));
        return;
      }
      if (generation.current !== startedFor) return;
      const reload = () => read(data, () => generation.current === startedFor);
      recovery.current = { read: reload, committed: true }; setBlocked(true);
      setNotice(message(locale, "workbench.members.completed"));
      saved?.(data);
      await recover(reload, true);
    } finally { if (generation.current === startedFor) { pending.current = false; onBusyChange(false); } }
  }
  async function read(nextAction: MemberAction, reload: (isCurrent: () => boolean) => Promise<void>) {
    if (recovery.current) return retry();
    if (pending.current) return;
    pending.current = true; onBusyChange(true); setAction(nextAction); setError(null);
    const startedFor = generation.current;
    try { await recover(() => reload(() => generation.current === startedFor), false); }
    finally { if (generation.current === startedFor) { pending.current = false; onBusyChange(false); } }
  }
  function delivery(status: "sent" | "skipped" | "failed") {
    setNotice(message(locale, status === "sent" ? "workbench.members.deliverySent" : status === "failed" ? "workbench.members.deliveryFailed" : "workbench.members.deliverySkipped"));
  }
  function clear() { if (!recovery.current && !pending.current) { setError(null); setNotice(null); } }
  return { action, error, notice, blocked, run, read, retry, delivery, clear };
}

export function MemberActionFeedback({ feedback, busy, locale }: { feedback: ReturnType<typeof useMemberActions>; busy: boolean; locale: Locale }) {
  return <div>
    {feedback.notice ? <p role="status">{feedback.notice}</p> : null}
    {feedback.error ? <p role="alert" className={styles.actionError}>{feedback.error}</p> : null}
    {feedback.blocked ? <button type="button" disabled={busy} onClick={() => void feedback.retry()}>{message(locale, "workbench.catalog.refreshData")}</button> : null}
  </div>;
}
