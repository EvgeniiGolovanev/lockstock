"use client";

import { useEffect, useId, useRef, useState } from "react";
import { message, type Locale } from "@/lib/i18n";
import styles from "./catalog-forms.module.css";

export function useCatalogFeedback({ scope, locale, onBusyChange, onRefreshCoreData, onActivity }: {
  scope: string;
  locale: Locale;
  onBusyChange: (busy: boolean) => void;
  onRefreshCoreData: () => Promise<void>;
  onActivity: (message: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState(false);
  const committedRef = useRef(false);
  const pending = useRef(false);
  const errorId = useId();
  useEffect(() => {
    // A completed write remains guarded even when its dialog is dismissed.
    if (!committedRef.current) setError(null);
  }, [scope]);

  async function refresh(close: () => void) {
    try {
      await onRefreshCoreData();
      committedRef.current = false;
      setCommitted(false);
      setError(null);
      close();
    } catch {
      setError(message(locale, "workbench.catalog.refreshFailed"));
      onActivity("Catalog operation completed, but refreshing data failed.");
    }
  }

  async function retry(close: () => void) {
    if (!committedRef.current || pending.current) return;
    pending.current = true;
    onBusyChange(true);
    try { await refresh(close); }
    finally { pending.current = false; onBusyChange(false); }
  }

  async function run(write: () => Promise<void>, close: () => void, rejected?: (error: unknown) => void) {
    if (pending.current || committedRef.current) return;
    pending.current = true;
    onBusyChange(true);
    setError(null);
    try {
      try { await write(); }
      catch (error) {
        const text = error instanceof Error && error.message.trim() ? error.message : message(locale, "workbench.catalog.unexpectedError");
        setError(text);
        onActivity(text);
        rejected?.(error);
        return;
      }
      committedRef.current = true;
      setCommitted(true);
      await refresh(close);
    } finally { pending.current = false; onBusyChange(false); }
  }

  return { error, errorId, committed, run, retry, setError };
}

export function CatalogFeedback({ feedback, busy, locale, close }: {
  feedback: ReturnType<typeof useCatalogFeedback>;
  busy: boolean;
  locale: Locale;
  close: () => void;
}) {
  return <>
    {feedback.error ? <p id={feedback.errorId} role="alert" className={styles.formError}>{feedback.error}</p> : null}
    {feedback.committed ? <button type="button" disabled={busy} onClick={() => void feedback.retry(close)}>{message(locale, "workbench.catalog.refreshData")}</button> : null}
  </>;
}
