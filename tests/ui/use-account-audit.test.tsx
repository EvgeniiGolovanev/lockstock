import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/api/browser-request", () => ({ browserApiRequest: mocks.request }));
import { useAccountAudit } from "@/lib/ui/use-account-audit";
const initial = { accountKey: "user-a", orgId: "a", enabled: true, refresh: 0, canExport: true, from: "2026-10-01", to: "2026-10-17" };
const deferred = <T,>() => { let resolve!: (data: T) => void, reject!: (error: Error) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("reports read failure without a false empty result and retries only the journal", async () => {
  mocks.request.mockRejectedValueOnce(new Error("Offline")).mockResolvedValue({ data: [] });
  const { result } = renderHook(() => useAccountAudit(initial));
  await waitFor(() => expect(result.current.state.phase).toBe("error"));
  await act(async () => { await result.current.retry(); });
  expect(result.current.state.phase).toBe("ready");
  expect(result.current.rows).toEqual([]);
  expect(mocks.request.mock.calls.map(([path]) => path)).toEqual(["/api/audit-log", "/api/audit-log"]);
});

it.each(["workspace", "account"])("clears rows and ignores delayed reads after a %s switch", async kind => {
  const old = deferred<{data: Array<{id:string}>}>();
  mocks.request.mockResolvedValue({ data: [{ id: "initial" }] });
  const { result, rerender } = renderHook(props => useAccountAudit(props), { initialProps: initial });
  await waitFor(() => expect(result.current.state.phase).toBe("ready"));
  mocks.request.mockReturnValueOnce(old.promise);
  let pending!: Promise<void>; act(() => { pending = result.current.retry(); });
  mocks.request.mockResolvedValue({ data: [] });
  rerender({ ...initial, ...(kind === "workspace" ? { orgId: "b" } : { accountKey: "user-b" }) });
  expect(result.current.rows).toEqual([]);
  await waitFor(() => expect(result.current.state.phase).toBe("ready"));
  await act(async () => { old.resolve({ data: [{ id: "obsolete" }] }); await pending; });
  expect(result.current.rows).toEqual([]);
});

it("preserves export dates through rejection and downloads once on retry", async () => {
  const blob = new Blob(["a,b\n1,2"], { type: "text/csv" });
  mocks.request.mockImplementation(async path => { if (path.includes("format=csv")) throw new Error("503"); return { data: [] }; });
  const create = vi.fn(() => "blob:test"), revoke = vi.fn(), click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create }); Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
  const { result } = renderHook(() => useAccountAudit(initial));
  await act(async () => { await result.current.download(); });
  expect(result.current.exportPhase).toBe("error"); expect(click).not.toHaveBeenCalled();
  mocks.request.mockResolvedValue(blob);
  await act(async () => { await result.current.download(); });
  expect(result.current.exportPhase).toBe("ready"); expect(click).toHaveBeenCalledOnce(); expect(create).toHaveBeenCalledWith(blob); expect(revoke).toHaveBeenCalledWith("blob:test");
  const csv = mocks.request.mock.calls.filter(([path]) => path.includes("format=csv"));
  expect(csv.map(([path]) => path)).toEqual(Array(2).fill("/api/audit-log?format=csv&from=2026-10-01&to=2026-10-17"));
});

it.each(["workspace", "account", "dates", "permission"].flatMap(kind => ["success", "failure"].map(outcome => ({ kind, outcome }))))("suppresses an old $outcome after changing $kind", async ({ kind, outcome }) => {
  const old = deferred<Blob>();
  mocks.request.mockImplementation(path => path.includes("format=csv") ? old.promise : Promise.resolve({ data: [] }));
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const { result, rerender } = renderHook(props => useAccountAudit(props), { initialProps: initial });
  let pending!: Promise<void>; act(() => { pending = result.current.download(); });
  expect(result.current.exportPhase).toBe("loading");
  rerender({ ...initial, ...(kind === "workspace" ? { orgId: "b" } : kind === "account" ? { accountKey: "b" } : kind === "permission" ? { canExport: false } : { from: "2026-10-02" }) });
  expect(result.current.exportPhase).toBe("idle");
  await act(async () => { if (outcome === "success") old.resolve(new Blob(["Old workspace"])); else old.reject(new Error("Old failure")); await pending; });
  expect(click).not.toHaveBeenCalled(); expect(result.current.exportPhase).toBe("idle");
});

it("does not read or export when disabled and does not export without permission", async () => {
  mocks.request.mockClear().mockResolvedValue({ data: [] });
  const { result, rerender } = renderHook(props => useAccountAudit(props), { initialProps: { ...initial, enabled: false } });
  await act(async () => { await result.current.retry(); await result.current.download(); });
  expect(mocks.request).not.toHaveBeenCalled();
  rerender({ ...initial, canExport: false });
  await waitFor(() => expect(result.current.state.phase).toBe("ready"));
  mocks.request.mockClear(); await act(async () => { await result.current.download(); });
  expect(mocks.request).not.toHaveBeenCalled();
});

it("labels retained rows as stale after a failed refresh and clears that state on recovery", async () => {
  mocks.request.mockResolvedValue({ data: [{ id: "stored" }] });
  const { result } = renderHook(() => useAccountAudit(initial));
  await waitFor(() => expect(result.current.state.phase).toBe("ready"));
  mocks.request.mockRejectedValueOnce(new Error("Offline"));
  await act(async () => { await result.current.retry(); });
  expect(result.current.rows.map(row => row.id)).toEqual(["stored"]);
  expect(result.current.state).toMatchObject({ phase: "error", hasData: true });
  mocks.request.mockResolvedValue({ data: [] });
  await act(async () => { await result.current.retry(); });
  expect(result.current.rows).toEqual([]); expect(result.current.state.phase).toBe("ready");
});

it("blocks a second export while pending and discards the result on unmount", async () => {
  const old = deferred<Blob>();
  mocks.request.mockClear().mockImplementation(path => path.includes("format=csv") ? old.promise : Promise.resolve({}));
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const { result, unmount } = renderHook(() => useAccountAudit(initial));
  let pending!: Promise<void>; act(() => { pending = result.current.download(); });
  await act(async () => { await result.current.download(); });
  expect(mocks.request.mock.calls.filter(([path]) => path.includes("format=csv"))).toHaveLength(1);
  unmount(); old.resolve(new Blob(["Old data"])); await pending;
  expect(click).not.toHaveBeenCalled();
});
