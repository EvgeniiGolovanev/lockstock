// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";

const { authMock } = vi.hoisted(() => ({
  authMock: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn()
  }
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}));

vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ locale: "en", setLocale: vi.fn() })
}));

vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />
}));

vi.mock("@/lib/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: authMock })
}));

vi.mock("@/lib/ui/demo-video", () => ({
  demoVideoHref: () => "/demo.mp4"
}));

import { LockstockLanding } from "@/components/lockstock-landing";

describe("LockstockLanding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.getSession.mockResolvedValue({ data: { session: null }, error: null });
    authMock.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it("renders the sign-in modal copy with real punctuation", async () => {
    render(<LockstockLanding />);

    await screen.findByRole("button", { name: "Sign In" });
    screen.getByRole("button", { name: "Sign In" }).click();

    expect(await screen.findByRole("dialog", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign up" })).toBeInTheDocument();
  });

  it("announces sign-in errors through a live region and links them to inputs", async () => {
    authMock.signInWithPassword.mockResolvedValueOnce({
      data: null,
      error: new Error("Invalid email or password")
    });

    const { container } = render(<LockstockLanding />);

    within(container.getElementsByTagName("header")[0]).getByRole("button", { name: "Sign In" }).click();
    const dialog = await screen.findByRole("dialog", { name: "Welcome back" });
    const authDialog = within(dialog);

    fireEvent.change(authDialog.getByRole("textbox", { name: "Email" }), { target: { value: "user@example.com" } });
    fireEvent.change(authDialog.getByLabelText("Password"), { target: { value: "secret123" } });
    fireEvent.click(authDialog.getByRole("button", { name: "Sign In" }));

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("Invalid email or password");
    expect(authDialog.getByRole("textbox", { name: "Email" })).toHaveAttribute("aria-describedby", error.id);
    expect(authDialog.getByLabelText("Password")).toHaveAttribute("aria-describedby", error.id);
  });
});
