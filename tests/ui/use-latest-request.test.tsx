import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import { isSupersededRequest, useLatestRequest } from "@/lib/ui/use-latest-request";
const deferred = <T,>() => { let resolve!: (data: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
describe("latest request", () => {
  it("only commits the newest read and recognizes a superseded success", async () => {
    const { result } = renderHook(() => useLatestRequest("a"));
    const old = deferred<number>(), commit = vi.fn();
    const first = result.current.run(() => old.promise, commit).catch(error => error);
    await result.current.run(async () => 2, commit);
    old.resolve(1);
    expect(isSupersededRequest(await first)).toBe(true);
    expect(commit.mock.calls).toEqual([[2]]);
  });
  it("invalidates old closures and late errors when the query or workspace changes", async () => {
    const { result, rerender } = renderHook(({ key }) => useLatestRequest(key), { initialProps: { key: "a" } });
    const old = result.current, read = deferred<number>(), commit = vi.fn();
    const pending = old.run(() => read.promise, commit).catch(error => error);
    rerender({ key: "b" });
    read.reject(new Error("Expired JWT"));
    expect(isSupersededRequest(await pending)).toBe(true);
    expect(isSupersededRequest(await old.run(async () => 1, commit).catch(error => error))).toBe(true);
    await result.current.run(async () => 2, commit);
    expect(commit.mock.calls).toEqual([[2]]);
  });
  it("preserves current errors and honors an enclosing failed refresh batch", async () => {
    const { result } = renderHook(() => useLatestRequest("a"));
    const error = new Error("Offline");
    await expect(result.current.run(async () => { throw error; }, vi.fn())).rejects.toBe(error);
    await expect(result.current.run(async () => 1, vi.fn(), () => false)).rejects.toSatisfy(isSupersededRequest);
    expect(isSupersededRequest(error)).toBe(false);
  });
  it("invalidates unmounted reads and works after StrictMode effect replay", async () => {
    const { result, unmount } = renderHook(() => useLatestRequest("a"), { wrapper: StrictMode });
    const commit = vi.fn(), read = deferred<number>();
    await result.current.run(async () => 1, commit);
    const pending = result.current.run(() => read.promise, commit).catch(error => error);
    unmount();
    await act(async () => read.resolve(2));
    expect(isSupersededRequest(await pending)).toBe(true);
    expect(commit.mock.calls).toEqual([[1]]);
  });
});
