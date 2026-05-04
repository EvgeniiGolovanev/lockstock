export type ActivityEntry = {
  id: string;
  line: string;
};

export const ACTIVITY_LOG_STORAGE_KEY = "lockstock.activityLog";
export const ACTIVITY_LOG_UPDATED_EVENT = "lockstock:activity-log-updated";
const ACTIVITY_LOG_LIMIT = 10;
const ANONYMOUS_ACTIVITY_SCOPE = "anonymous";

export function getActivityLogStorageKey(accountKey: string) {
  const normalizedAccountKey = accountKey.trim().toLowerCase() || ANONYMOUS_ACTIVITY_SCOPE;
  return `${ACTIVITY_LOG_STORAGE_KEY}:${encodeURIComponent(normalizedAccountKey)}`;
}

export function createActivityEntry(
  message: string,
  now = new Date(),
  randomId = () => Math.random().toString(36).slice(2, 10)
): ActivityEntry {
  return {
    id: `${now.getTime()}-${randomId()}`,
    line: `${now.toLocaleTimeString()} - ${message}`
  };
}

export function prependActivityEntry(entries: ActivityEntry[], entry: ActivityEntry): ActivityEntry[] {
  return [entry, ...entries].slice(0, ACTIVITY_LOG_LIMIT);
}

export function parseActivityEntries(raw: string | null): ActivityEntry[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const seenIds = new Set<string>();

    return parsed
      .filter((entry): entry is ActivityEntry => typeof entry?.id === "string" && typeof entry?.line === "string")
      .filter((entry) => {
        if (seenIds.has(entry.id)) {
          return false;
        }

        seenIds.add(entry.id);
        return true;
      })
      .slice(0, ACTIVITY_LOG_LIMIT);
  } catch {
    return [];
  }
}

export function serializeActivityEntries(entries: ActivityEntry[]): string {
  return JSON.stringify(entries.slice(0, ACTIVITY_LOG_LIMIT));
}
