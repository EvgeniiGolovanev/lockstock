import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const navigation = vi.hoisted(() => ({ pathname: "/locations" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: vi.fn() })
}));
vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ locale: "en", setLocale: vi.fn() })
}));
vi.mock("@/lib/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } })
    }
  })
}));

import { LockstockWorkbench } from "@/components/lockstock-workbench";

describe("catalog dialogs in the complete workbench", () => {
  beforeEach(() => {
    navigation.pathname = "/locations";
    window.localStorage.clear();
    window.history.replaceState({}, "", "/locations?demo=1");
  });
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("opens the create dialog from the Locations page", async () => {
    render(<LockstockWorkbench />);
    fireEvent.click(await screen.findByRole("button", { name: "Add Location" }));
    const dialog = await screen.findByRole("dialog", { name: "Add location" });
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("Main Warehouse");
    expect(within(dialog).getByRole("button", { name: "Create Location" })).toBeEnabled();
  });

  it("opens edit and block dialogs for the selected location", async () => {
    render(<LockstockWorkbench />);
    const row = await screen.findByRole("row", { name: /MAIN Main Warehouse/ });
    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit location" });
    expect(within(dialog).getByRole("textbox", { name: "Code" })).toHaveValue("MAIN");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    fireEvent.click(within(row).getByRole("button", { name: "Block" }));
    expect(await screen.findByRole("dialog", { name: "Confirm location usage change" })).toHaveTextContent("Main Warehouse");
  });

  it("renders one vendor toolbar and opens its create dialog", async () => {
    navigation.pathname = "/vendors";
    window.history.replaceState({}, "", "/vendors?demo=1");
    render(<LockstockWorkbench />);
    const buttons = await screen.findAllByRole("button", { name: "Add Vendor" });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(await screen.findByRole("dialog", { name: "Add vendor" })).toBeVisible();
  });
});
