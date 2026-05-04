"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ACTIVITY_LOG_UPDATED_EVENT,
  createActivityEntry,
  getActivityLogStorageKey,
  parseActivityEntries,
  prependActivityEntry,
  serializeActivityEntries,
  type ActivityEntry
} from "@/lib/ui/activity-log";

function readStoredActivity(storageKey: string): ActivityEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  return parseActivityEntries(window.localStorage.getItem(storageKey));
}

function writeStoredActivity(storageKey: string, entries: ActivityEntry[]) {
  window.localStorage.setItem(storageKey, serializeActivityEntries(entries));
  window.dispatchEvent(new Event(ACTIVITY_LOG_UPDATED_EVENT));
}

export function useActivityLog(accountKey = "") {
  const storageKey = getActivityLogStorageKey(accountKey);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    setActivity(readStoredActivity(storageKey));

    const syncActivity = () => setActivity(readStoredActivity(storageKey));
    window.addEventListener("storage", syncActivity);
    window.addEventListener(ACTIVITY_LOG_UPDATED_EVENT, syncActivity);

    return () => {
      window.removeEventListener("storage", syncActivity);
      window.removeEventListener(ACTIVITY_LOG_UPDATED_EVENT, syncActivity);
    };
  }, [storageKey]);

  const addActivity = useCallback((message: string) => {
    const entry = createActivityEntry(message);
    const next = prependActivityEntry(readStoredActivity(storageKey), entry);
    writeStoredActivity(storageKey, next);
    setActivity(next);
  }, [storageKey]);

  return { activity, addActivity };
}
