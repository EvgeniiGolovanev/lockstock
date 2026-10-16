import { act, cleanup, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ request: vi.fn(), path: "/materials" }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.path, useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/components/language-provider", () => ({ useLanguage: () => ({ locale: "en" }) }));
vi.mock("@/lib/api/browser-request", () => ({ browserApiRequest: mocks.request }));
vi.mock("@/lib/supabase-browser", () => ({ getSupabaseBrowserClient: () => ({ auth: {
  getSession: async () => ({ data: { session: { access_token: "token", user: { email: "owner@example.test", user_metadata: {} } } } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } })
} }) }));
import { LockstockWorkbench } from "@/components/lockstock-workbench";
afterEach(() => { cleanup(); configure({ asyncUtilTimeout: 1000 }); });
const material = (name: string) => ({ id: name, sku: name, name, uom: "PC", is_active: true, min_stock: 0, total_quantity: 10, balances: [] });

function setup(path: string, resource: string, row: (name: string) => unknown, override?: (url: string) => unknown) {
  configure({ asyncUtilTimeout: 5000 });
  mocks.path = path;
  window.localStorage.clear(); window.localStorage.setItem("lockstock.orgId", "a");
  let release!: (data: unknown) => void;
  let reject!: (error: Error) => void;
  let orgLoads = 0;
  mocks.request.mockImplementation(async (url: string, options?: { orgId?: string }) => {
    const overridden = override?.(url);
    if (overridden !== undefined) return overridden;
    if (url === "/api/organizations") { orgLoads++; return { data: ["a", "b"].map(id => ({ role: "owner", organization: { id, name: `Workspace ${id}`, created_at: "2026-10-16" } })) }; }
    if (url.startsWith(resource)) {
      const query = new URL(url, "http://local").searchParams.get("q");
      if (query === "Old") return new Promise((done, fail) => { release = done; reject = fail; });
      return { data: [row(`${options?.orgId ?? "a"}-${query || "Initial"}`)], meta: { total: 1, total_pages: 1 } };
    }
    return { data: [], meta: { total: 0, total_pages: 1 }, isPlatformAdmin: false };
  });
  const view = render(<LockstockWorkbench />);
  return { view, release: () => release({ data: [row("Old result")], meta: { total: 999, total_pages: 100 } }), reject: () => reject(new Error("JWT from obsolete request")), pending: () => !!release, orgLoads: () => orgLoads };
}

it.each([
  ["materials", "/materials", "/api/materials?", "Search by name or SKU...", material],
  ["suppliers", "/vendors", "/api/suppliers?", "Filter by vendor name, ID, phone, or address", (name: string) => ({ id: name, name, is_active: true })],
  ["orders", "/purchase-orders", "/api/purchase-orders?", "Search by PO number...", (name: string) => ({ id: name, po_number: name, status: "draft", currency: "EUR", created_at: "2026-10-16", supplier: { name: "Vendor" }, lines: [] })]
])("keeps the latest %s search when an older response arrives last", async (_name, path, resource, placeholder, row) => {
  const test = setup(path, resource, row);
  await screen.findAllByText("a-Initial");
  await act(async () => {});
  const baseline = test.orgLoads();
  const input = screen.getByPlaceholderText(placeholder);
  fireEvent.change(input, { target: { value: "Old" } });
  await waitFor(() => expect(test.pending()).toBe(true));
  fireEvent.change(input, { target: { value: "New" } });
  await waitFor(() => expect(screen.getAllByText("a-New").length).toBeGreaterThan(0));
  await act(async () => test.release());
  expect(screen.queryAllByText("Old result")).toHaveLength(0);
  expect(screen.getAllByText("a-New").length).toBeGreaterThan(0);
  expect(test.orgLoads()).toBe(baseline);
});

it("retains unrelated location loads when a filter changes during bootstrap", async () => {
  let release!: (data: unknown) => void;
  const locations = new Promise(done => { release = done; });
  const test = setup("/materials", "/api/materials?", material, url => url === "/api/locations" ? locations : undefined);
  await screen.findAllByText("a-Initial");
  fireEvent.change(screen.getByPlaceholderText("Search by name or SKU..."), { target: { value: "New" } });
  await screen.findAllByText("a-New");
  await act(async () => release({ data: [{ id: "loc", name: "Preserved warehouse", is_active: true }] }));
  mocks.path = "/stock-movements"; test.view.rerender(<LockstockWorkbench />);
  fireEvent.click(screen.getByRole("button", { name: "Move Material" }));
  expect(screen.getAllByRole("option", { name: "Preserved warehouse" }).length).toBeGreaterThan(0);
});

it("ignores a delayed failure after switching workspace instead of clearing the new session", async () => {
  const test = setup("/materials", "/api/materials?", material);
  await screen.findAllByText("a-Initial");
  await act(async () => {});
  fireEvent.change(screen.getByPlaceholderText("Search by name or SKU..."), { target: { value: "Old" } });
  await waitFor(() => expect(test.pending()).toBe(true));
  mocks.path = "/members"; test.view.rerender(<LockstockWorkbench />);
  const open = screen.getByRole("button", { name: "Open Group" });
  expect(open).toBeEnabled();
  fireEvent.click(open);
  mocks.path = "/materials"; test.view.rerender(<LockstockWorkbench />);
  fireEvent.change(screen.getByPlaceholderText("Search by name or SKU..."), { target: { value: "New" } });
  await waitFor(() => expect(screen.getAllByText("b-New").length).toBeGreaterThan(0));
  await act(async () => test.reject());
  expect(screen.getByText(/Active workspace:/)).toHaveTextContent("Workspace b");
  expect(screen.getAllByText("b-New").length).toBeGreaterThan(0);
});

it("shows loading and read errors, retains rows as stale, and retries the current search without writes", async () => {
  let fail = true;
  const test = setup("/materials", "/api/materials?", material, url => {
    if (url.includes("q=Failed") && fail) return Promise.reject(new Error("Internal database details must not appear"));
  });
  await screen.findAllByText("a-Initial");
  fireEvent.change(screen.getByPlaceholderText("Search by name or SKU..."), { target: { value: "Old" } });
  await waitFor(() => expect(test.pending()).toBe(true));
  expect(screen.getByRole("status")).toHaveTextContent("Loading data");
  expect(screen.queryByText("No materials match these filters.")).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Search by name or SKU..."), { target: { value: "Failed" } });
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load data");
  expect(screen.getByRole("alert")).toHaveTextContent("Displayed data has not been refreshed");
  expect(screen.queryByText(/Internal database details/)).not.toBeInTheDocument();
  expect(screen.getAllByText("a-Initial").length).toBeGreaterThan(0);
  const baseline = mocks.request.mock.calls.length;
  fail = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findAllByText("a-Failed");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(mocks.request.mock.calls.slice(baseline).map(([url, options]) => [url, options.method ?? "GET"])).toEqual([
    [expect.stringContaining("q=Failed"), "GET"]
  ]);
  await act(async () => test.reject());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("describes an empty supplier search as no matches rather than no suppliers", async () => {
  setup("/vendors", "/api/suppliers?", name => ({ id: name, name, is_active: true }), url => url.includes("q=Missing") ? { data: [], meta: { total: 0, total_pages: 1 } } : undefined);
  await screen.findAllByText("a-Initial");
  fireEvent.change(screen.getByPlaceholderText("Filter by vendor name, ID, phone, or address"), { target: { value: "Missing" } });
  await act(async () => {});
  expect(screen.getByText("No suppliers match these filters.")).toBeVisible();
  expect(screen.queryByText("No suppliers created yet.")).not.toBeInTheDocument();
});
