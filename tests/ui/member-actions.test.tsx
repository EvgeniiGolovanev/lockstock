import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberActionFeedback, useMemberActions } from "@/components/workbench/member-actions";
afterEach(cleanup);
function setup() {
  const props = { scope: "user", locale: "en" as "en" | "fr", onBusyChange: vi.fn() };
  return { props, ...renderHook(() => useMemberActions(props)) };
}
describe("member action feedback", () => {
  for (const action of ["rename", "invite", "accept", "reject", "remove", "leave"] as const) {
    it(`${action}: shows rejected writes and permits a successful retry`, async () => {
      const { result } = setup();
      const write = vi.fn().mockRejectedValueOnce(new Error("Permission changed")).mockResolvedValue("saved");
      const read = vi.fn().mockResolvedValue(undefined);
      await act(() => result.current.run(action, write, read));
      expect(result.current.error).toBe("Permission changed");
      expect(read).not.toHaveBeenCalled();
      await act(() => result.current.run(action, write, read));
      expect(write).toHaveBeenCalledTimes(2);
      expect(read).toHaveBeenCalledWith("saved", expect.any(Function));
      expect(result.current.error).toBeNull();
    });
    it(`${action}: blocks all further writes and repeats only reads after commit`, async () => {
      const { result } = setup();
      const write = vi.fn().mockResolvedValue({ id: "saved" });
      const read = vi.fn().mockRejectedValueOnce(new Error("private read detail")).mockRejectedValueOnce(new Error("still unavailable")).mockResolvedValue(undefined);
      await act(() => result.current.run(action, write, read));
      expect(result.current.error).toContain("The operation completed");
      expect(result.current.error).not.toContain("private");
      expect(result.current.blocked).toBe(true);
      await act(() => result.current.run("invite", write, read));
      expect(write).toHaveBeenCalledTimes(1);
      await act(() => result.current.retry());
      expect(result.current.blocked).toBe(true);
      await act(() => result.current.retry());
      expect(result.current.blocked).toBe(false);
      expect(read).toHaveBeenCalledTimes(3);
      expect(write).toHaveBeenCalledTimes(1);
    });
  }
  for (const delivery of ["sent", "skipped", "failed"] as const) {
    it(`announces invitation creation separately from ${delivery} delivery`, async () => {
      const { result } = setup();
      await act(() => result.current.run("invite", async () => delivery, async () => {}, value => result.current.delivery(value)));
      expect(result.current.notice).toContain("Invitation created.");
      expect(result.current.notice).toContain(delivery === "sent" ? "Email sent." : delivery === "failed" ? "Email delivery failed." : "Email delivery skipped.");
    });
  }
  it("handles a non-Error rejection in French and clears feedback on account change", async () => {
    const { result, props, rerender } = setup(); props.locale = "fr"; rerender();
    await act(() => result.current.run("rename", async () => { throw { secret: "internal" }; }, async () => {}));
    expect(result.current.error).toBe("L'operation n'a pas pu etre effectuee. Veuillez reessayer.");
    props.scope = "other-user"; rerender();
    expect(result.current.error).toBeNull();
    expect(result.current.blocked).toBe(false);
  });
  it("shows read failures and recovers without a mutation", async () => {
    const { result } = setup();
    const read = vi.fn().mockRejectedValueOnce(new Error("read unavailable")).mockResolvedValue(undefined);
    await act(() => result.current.read("members", read));
    expect(result.current.error).toContain("could not be loaded");
    await act(() => result.current.retry());
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
  });
  it("ignores simultaneous submissions and an empty refresh retry", async () => {
    const { result } = setup();
    let resolve!: (value: string) => void;
    const write = vi.fn(() => new Promise<string>(done => { resolve = done; }));
    const read = vi.fn().mockResolvedValue(undefined);
    await act(() => result.current.retry());
    let pending!: Promise<void>;
    act(() => { pending = result.current.run("invite", write, read); });
    await act(() => result.current.run("invite", write, read));
    await act(async () => { resolve("done"); await pending; });
    expect(write).toHaveBeenCalledTimes(1);
  });
  it("releases busy after external sign-out and ignores the old account's completion", async () => {
    const { result, props, rerender } = setup();
    let resolve!: (value: string) => void;
    const read = vi.fn();
    let pending!: Promise<void>;
    act(() => { pending = result.current.run("invite", () => new Promise<string>(done => { resolve = done; }), read); });
    expect(props.onBusyChange).toHaveBeenLastCalledWith(true);
    props.scope = ""; rerender();
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
    props.scope = "user"; rerender();
    await act(async () => { resolve("saved"); await pending; });
    expect(read).not.toHaveBeenCalled();
    expect(result.current.notice).toBeNull();
    expect(result.current.blocked).toBe(false);
  });
  it("invalidates a delayed recovery read before it can restore old account data", async () => {
    const { result, props, rerender } = setup();
    let resolve!: () => void;
    const commitRows = vi.fn();
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.run("rename", async () => "saved", async (_data, current) => {
        await new Promise<void>(done => { resolve = done; });
        if (current()) commitRows();
      });
    });
    await act(async () => { await Promise.resolve(); });
    props.scope = ""; rerender();
    await act(async () => { resolve(); await pending; });
    expect(commitRows).not.toHaveBeenCalled();
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
  });
  it("renders accessible delivery and recovery feedback and clears rejected feedback", async () => {
    const { result } = setup();
    await act(() => result.current.run("invite", async () => "skipped" as const, async () => { throw new Error("read"); }, value => result.current.delivery(value)));
    const { rerender } = render(<MemberActionFeedback feedback={result.current} busy={false} locale="en" />);
    expect(screen.getByRole("status")).toHaveTextContent("Invitation created");
    expect(screen.getByRole("alert")).toHaveTextContent("The operation completed");
    act(() => result.current.clear());
    expect(result.current.blocked).toBe(true);
    rerender(<MemberActionFeedback feedback={result.current} busy={true} locale="en" />);
    expect(screen.getByRole("button", { name: "Refresh data" })).toBeDisabled();
    rerender(<MemberActionFeedback feedback={result.current} busy={false} locale="en" />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Refresh data" })); });
    const clean = setup();
    await act(() => clean.result.current.run("rename", async () => { throw new Error("rejected"); }, async () => {}));
    act(() => clean.result.current.clear());
    expect(clean.result.current.error).toBeNull();
  });
});
