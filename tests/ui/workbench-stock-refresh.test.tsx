import { act, cleanup, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/stock-movements", useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/components/language-provider", () => ({ useLanguage: () => ({ locale: "en" }) }));
vi.mock("@/lib/api/browser-request", () => ({ browserApiRequest: mocks.request }));
vi.mock("@/lib/supabase-browser", () => ({ getSupabaseBrowserClient: () => ({ auth: {
  getSession: async () => ({ data: { session: { access_token: "token", user: { email: "owner@example.test", user_metadata: {} } } } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } })
} }) }));
import { LockstockWorkbench } from "@/components/lockstock-workbench";
afterEach(() => { cleanup(); configure({ asyncUtilTimeout: 1000 }); });

it("ignores a late sibling response from a failed stock refresh after a successful retry", async () => {
  configure({ asyncUtilTimeout: 5000 });
  window.localStorage.clear(); window.localStorage.setItem("lockstock.orgId", "org");
  let phase = 0;
  let releaseOld!: (data: unknown) => void;
  const movement = (note: string) => ({ id: note, quantity_delta: 1, reason: "adjustment", note, created_at: "2026-10-16", material: { sku: "MAT", name: "Cement", uom: "PC" }, location: { name: "Warehouse" } });
  mocks.request.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (path === "/api/organizations") return { data: [{ role: "owner", organization: { id: "org", name: "Workspace", created_at: "2026-10-16" } }] };
    if (path === "/api/locations") return { data: [{ id: "loc", name: "Warehouse", code: "WH", is_active: true }] };
    if (path === "/api/stock/movements" && options?.method === "POST") { phase = 1; return { data: { id: "saved" } }; }
    if (path.startsWith("/api/materials?")) {
      if (phase === 1) throw new Error("Materials unavailable");
      return { data: [{ id: "mat", sku: "MAT", name: "Cement", uom: "PC", is_active: true, min_stock: 0, total_quantity: 10, balances: [] }], meta: { total: 1 } };
    }
    if (path.startsWith("/api/stock/movements?")) {
      if (phase === 1) return new Promise(done => { releaseOld = done; });
      return { data: phase === 2 ? [movement("Latest ledger")] : [], meta: { total: phase === 2 ? 1 : 0 } };
    }
    return { data: [], meta: { total: 0 }, isPlatformAdmin: false };
  });
  render(<LockstockWorkbench />);
  const open = await screen.findByRole("button", { name: "Move Material" });
  await waitFor(() => expect(open).toBeEnabled());
  fireEvent.click(open);
  fireEvent.click(screen.getByRole("button", { name: "Add to Stock" }));
  await screen.findByText(/The operation completed/);
  expect(releaseOld).toBeDefined();
  phase = 2;
  fireEvent.click(screen.getByRole("button", { name: "Refresh data" }));
  await screen.findByText("Latest ledger");
  await act(async () => { releaseOld({ data: [movement("Stale ledger")], meta: { total: 1 } }); });
  expect(screen.getByText("Latest ledger")).toBeInTheDocument();
  expect(screen.queryByText("Stale ledger")).not.toBeInTheDocument();
});
