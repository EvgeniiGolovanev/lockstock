import { describe, expect, it } from "vitest";
import {
  createActivityEntry,
  getActivityLogStorageKey,
  parseActivityEntries,
  prependActivityEntry,
  serializeActivityEntries
} from "@/lib/ui/activity-log";

describe("activity log helpers", () => {
  it("creates timestamped activity entries", () => {
    const now = new Date("2026-05-04T10:15:30Z");
    const entry = createActivityEntry("Material created.", now, () => "abc123");

    expect(entry).toEqual({
      id: "1777889730000-abc123",
      line: `${now.toLocaleTimeString()} - Material created.`
    });
  });

  it("prepends entries and keeps the newest ten", () => {
    const existing = Array.from({ length: 10 }, (_, index) => ({
      id: `old-${index}`,
      line: `old ${index}`
    }));

    const next = prependActivityEntry(existing, { id: "new", line: "new item" });

    expect(next).toHaveLength(10);
    expect(next[0]).toEqual({ id: "new", line: "new item" });
    expect(next.at(-1)).toEqual({ id: "old-8", line: "old 8" });
  });

  it("parses only valid stored entries", () => {
    const raw = JSON.stringify([
      { id: "one", line: "valid" },
      { id: 2, line: "invalid id" },
      { id: "three", line: null }
    ]);

    expect(parseActivityEntries(raw)).toEqual([{ id: "one", line: "valid" }]);
    expect(parseActivityEntries("bad json")).toEqual([]);
  });

  it("deduplicates stored entries by id", () => {
    const raw = JSON.stringify([
      { id: "same", line: "newest" },
      { id: "same", line: "older duplicate" },
      { id: "other", line: "different" }
    ]);

    expect(parseActivityEntries(raw)).toEqual([
      { id: "same", line: "newest" },
      { id: "other", line: "different" }
    ]);
  });

  it("serializes entries for browser storage", () => {
    expect(serializeActivityEntries([{ id: "one", line: "valid" }])).toBe('[{"id":"one","line":"valid"}]');
  });

  it("scopes storage keys by normalized account", () => {
    expect(getActivityLogStorageKey("  Alex@Example.com ")).toBe("lockstock.activityLog:alex%40example.com");
    expect(getActivityLogStorageKey("")).toBe("lockstock.activityLog:anonymous");
  });
});
