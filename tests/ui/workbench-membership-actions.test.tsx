import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ request: vi.fn(), activity: vi.fn(), router: { push: vi.fn(), replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/members", useRouter: () => mocks.router }));
vi.mock("@/components/language-provider", () => ({ useLanguage: () => ({ locale: "en", setLocale: vi.fn() }) }));
vi.mock("@/lib/api/browser-request", () => ({ browserApiRequest: mocks.request }));
vi.mock("@/lib/ui/use-activity-log", () => ({ useActivityLog: () => ({ activity: [], addActivity: mocks.activity }) }));
vi.mock("@/lib/supabase-browser", () => ({ getSupabaseBrowserClient: () => ({ auth: {
  getSession: async () => ({ data: { session: { access_token: "token", user: { email: "test@example.test", user_metadata: {} } } } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } })
} }) }));
import { LockstockWorkbench } from "@/components/lockstock-workbench";

const own = { role: "owner", organization: { id: "own", name: "My workspace", created_at: "2026-09-01" } };
const joined = { role: "member", organization: { id: "joined", name: "Invited workspace", created_at: "2026-09-01" } };
let accepted: boolean;
let left: boolean;
let refreshFails: boolean;
beforeEach(() => {
  configure({ asyncUtilTimeout: 5000 });
  vi.clearAllMocks();
  window.localStorage.clear();
  window.localStorage.setItem("lockstock.orgId", "own");
  accepted = false; left = false; refreshFails = false;
  mocks.request.mockImplementation(async (path: string) => {
    if (path === "/api/organizations") return { data: accepted && !left ? [own, joined] : [own] };
    if (path === "/api/invitations/invite/accept") { accepted = true; return { data: { org_id: "joined", organization_name: "Invited workspace", membership_role: "member" } }; }
    if (path === "/api/invitations/invite/reject") { left = true; return { data: { organization_name: "Invited workspace" } }; }
    if (path === "/api/organizations/joined/leave") { left = true; return { data: { removed: true } }; }
    if (path === "/api/invitations/pending") return { data: accepted || left ? [] : [{ id: "invite", direction: "received", status: "pending", organization_name: "Invited workspace", email: "test@example.test", role: "member", expires_at: "2026-10-05" }] };
    if (path === "/api/organizations/joined/members") throw new Error("This action requires manager role or higher.");
    if (accepted && refreshFails && path.startsWith("/api/materials")) throw new Error("Inventory unavailable");
    return { data: [], meta: { total: 0 }, isPlatformAdmin: false };
  });
});
afterEach(() => { cleanup(); configure({ asyncUtilTimeout: 1000 }); });

it("removes accepted invitation controls even when unrelated workspace refresh fails", async () => {
  render(<LockstockWorkbench />);
  const accept = await screen.findByRole("button", { name: "Accept" });
  await waitFor(() => expect(accept).toBeEnabled());
  refreshFails = true;
  fireEvent.click(accept);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument());
  expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
});

it("refreshes memberships for a member without requesting the restricted member directory", async () => {
  render(<LockstockWorkbench />);
  const accept = await screen.findByRole("button", { name: "Accept" });
  await waitFor(() => expect(accept).toBeEnabled());
  fireEvent.click(accept);
  await waitFor(() => expect(window.localStorage.getItem("lockstock.orgId")).toBe("joined"));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Accept" })).toBeNull());
  expect(mocks.request.mock.calls.some(([path]) => path === "/api/organizations/joined/members")).toBe(false);
});

it("lets a non-owner leave the active group and returns to their own workspace", async () => {
  accepted = true;
  window.localStorage.setItem("lockstock.orgId", "joined");
  render(<LockstockWorkbench />);
  const leave = await screen.findByRole("button", { name: "Leave group" });
  await waitFor(() => expect(leave).toBeEnabled());
  fireEvent.click(leave);
  const dialog = await screen.findByRole("dialog", { name: "Leave group" });
  expect(within(dialog).queryByRole("button", { name: /Close/ })).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Leave group" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Leave group" })).toBeNull());
  expect(window.localStorage.getItem("lockstock.orgId")).toBe("own");
});

it("keeps the membership and current workspace when leaving fails", async () => {
  accepted = true;
  window.localStorage.setItem("lockstock.orgId", "joined");
  const normalRequest = mocks.request.getMockImplementation()!;
  mocks.request.mockImplementation((path: string, ...args: unknown[]) => {
    if (path.endsWith("/leave")) throw new Error("Unable to remove membership");
    return normalRequest(path, ...args);
  });
  render(<LockstockWorkbench />);
  const leave = await screen.findByRole("button", { name: "Leave group" });
  await waitFor(() => expect(leave).toBeEnabled());
  fireEvent.click(leave);
  const dialog = await screen.findByRole("dialog", { name: "Leave group" });
  expect(within(dialog).queryByRole("button", { name: /Close/ })).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Leave group" }));
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Leave group" })).toBeEnabled());
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Unable to remove membership");
  expect(window.localStorage.getItem("lockstock.orgId")).toBe("joined");
  expect(screen.getByRole("row", { name: /Invited workspace member/ })).toBeInTheDocument();
  mocks.request.mockImplementation(normalRequest);
  fireEvent.click(within(dialog).getByRole("button", { name: "Leave group" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(window.localStorage.getItem("lockstock.orgId")).toBe("own");
});

it("removes rejected invitation controls immediately", async () => {
  render(<LockstockWorkbench />);
  const reject = await screen.findByRole("button", { name: "Reject" });
  await waitFor(() => expect(reject).toBeEnabled());
  fireEvent.click(reject);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Reject" })).toBeNull());
  expect(screen.queryByRole("button", { name: "Leave group" })).toBeNull();
  expect(window.localStorage.getItem("lockstock.orgId")).toBe("own");
});


it("keeps Cancel and Escape available without the redundant Close button", async () => {
  accepted = true;
  render(<LockstockWorkbench />);
  const leave = await screen.findByRole("button", { name: "Leave group" });
  await waitFor(() => expect(leave).toBeEnabled());
  leave.focus();
  fireEvent.click(leave);
  const dialog = await screen.findByRole("dialog", { name: "Leave group" });
  const cancel = within(dialog).getByRole("button", { name: "Cancel" });
  expect(cancel).toHaveFocus();
  fireEvent.click(cancel);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(leave).toHaveFocus();
  fireEvent.click(leave);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(mocks.request.mock.calls.some(([path]) => path.endsWith("/leave"))).toBe(false);
});
