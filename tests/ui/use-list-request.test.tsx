import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { useListRequest } from "@/lib/ui/use-list-request";
import { isSupersededRequest } from "@/lib/ui/use-latest-request";

function deferred() {
  let resolve!: (value: number) => void, reject!: (error: Error) => void;
  const promise = new Promise<number>((done, fail) => { resolve = done; reject = fail; });
  return { resolve, reject, promise };
}

it("tracks initial loading, rejection, retry and successful empty results", async () => {
  const { result } = renderHook(() => useListRequest("a"));
  const stable = result.current.request;
  expect(result.current.state).toMatchObject({ phase: "loading", hasData: false });
  await act(async () => { await stable.run(async () => { throw new Error("Offline"); }, vi.fn()).catch(() => {}); });
  expect(result.current.state).toMatchObject({ phase: "error", hasData: false });
  const pending = deferred(); let request!: Promise<number>;
  act(() => { request = stable.run(() => pending.promise, vi.fn()); });
  expect(result.current.state.phase).toBe("loading");
  await act(async () => { pending.resolve(0); await request; });
  expect(result.current.state).toMatchObject({ phase: "ready", hasData: true });
  expect(result.current.request).toBe(stable);
});

it("retains prior results only within the same workspace and account scope", async () => {
  const { result, rerender } = renderHook(({ scope, query }) => useListRequest(scope, query), { initialProps: { scope: "a", query: "old" } });
  await act(async () => { await result.current.request.run(async () => 1, vi.fn()); });
  rerender({ scope: "a", query: "new" });
  expect(result.current.state).toEqual({ phase: "loading", hasData: true });
  await act(async () => { await result.current.request.run(async () => { throw new Error("503"); }, vi.fn()).catch(() => {}); });
  expect(result.current.state).toMatchObject({ phase: "error", hasData: true });
  rerender({ scope: "b", query: "new" });
  expect(result.current.state).toEqual({ phase: "loading", hasData: false });
});

it.each(["success", "failure"])("ignores obsolete %s after a new query succeeds", async outcome => {
  const { result, rerender } = renderHook(({ query }) => useListRequest("a", query), { initialProps: { query: "old" } });
  const pending = deferred(), commit = vi.fn(); let old!: Promise<unknown>;
  act(() => { old = result.current.request.run(() => pending.promise, commit).catch(error => error); });
  const previous = result.current.request;
  rerender({ query: "new" });
  await act(async () => { await result.current.request.run(async () => 2, commit); });
  await act(async () => {
    if (outcome === "success") pending.resolve(1); else pending.reject(new Error("Old failure"));
    expect(isSupersededRequest(await old)).toBe(true);
    expect(isSupersededRequest(await previous.run(async () => 3, commit).catch(error => error))).toBe(true);
  });
  expect(result.current.state.phase).toBe("ready");
  expect(commit.mock.calls).toEqual([[2]]);
});

it("an older request in the same query cannot end its successor's loading state", async () => {
  const { result } = renderHook(() => useListRequest("a"));
  const first = deferred(), second = deferred(); let old!: Promise<unknown>, current!: Promise<number>;
  act(() => { old = result.current.request.run(() => first.promise, vi.fn()).catch(error => error); current = result.current.request.run(() => second.promise, vi.fn()); });
  await act(async () => { first.reject(new Error("Old")); await old; });
  expect(result.current.state.phase).toBe("loading");
  await act(async () => { second.resolve(2); await current; });
  expect(result.current.state.phase).toBe("ready");
});

it("settles a read cancelled by a failed enclosing refresh batch and permits retry", async () => {
  const { result } = renderHook(() => useListRequest("a"));
  const pending = deferred(); let active = true, request!: Promise<unknown>;
  act(() => { request = result.current.request.run(() => pending.promise, vi.fn(), () => active).catch(error => error); });
  await act(async () => { active = false; pending.resolve(1); expect(isSupersededRequest(await request)).toBe(true); });
  expect(result.current.state.phase).toBe("error");
  await act(async () => { await result.current.request.run(async () => 2, vi.fn()); });
  expect(result.current.state.phase).toBe("ready");
});

it("invalidates reads on unmount and supports StrictMode lifecycle replay", async () => {
  const { result, unmount } = renderHook(() => useListRequest("a"), { wrapper: StrictMode });
  await act(async () => { await result.current.request.run(async () => 1, vi.fn()); });
  const pending = deferred(); let request!: Promise<unknown>;
  act(() => { request = result.current.request.run(() => pending.promise, vi.fn()).catch(error => error); });
  unmount();
  pending.resolve(2);
  expect(isSupersededRequest(await request)).toBe(true);
});

it("requires a new load when returning to an earlier query before an intermediate read starts", async () => {
  const { result, rerender } = renderHook(({ scope }) => useListRequest(scope), { initialProps: { scope: "a" } });
  await act(async () => { await result.current.request.run(async () => 1, vi.fn()); });
  rerender({ scope: "b" });
  rerender({ scope: "a" });
  expect(result.current.state.phase).toBe("loading");
});
