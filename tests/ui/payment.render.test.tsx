// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const { authMock } = vi.hoisted(() => ({
  authMock: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn()
  }
}));

const session = {
  access_token: "token",
  refresh_token: "refresh",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: "bearer",
  user: {
    id: "user-1",
    aud: "authenticated",
    role: "authenticated",
    email: "ava@northstar.build",
    user_metadata: { full_name: "Ava Laurent", selected_plan: "business" },
    app_metadata: { provider: "email", providers: ["email"] }
  }
};

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("@/lib/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: authMock })
}));

import { LockstockPayment } from "@/components/lockstock-payment";

function mockJsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body
  } as Response;
}

describe("LockstockPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem("lockstock.orgId", "org-1");
    authMock.getSession.mockResolvedValue({ data: { session }, error: null });
    authMock.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/billing/summary")) {
          return mockJsonResponse({
            data: {
              plan: "business",
              status: "trialing",
              billing_interval: "monthly",
              stripe_subscription_id: null,
              current_period_end: null,
              scheduled_plan: null,
              scheduled_interval: null,
              scheduled_effective_at: null
            }
          });
        }
        return mockJsonResponse({ data: {} });
      })
    );
  });

  it("renders the paid-plan and trial entry points", async () => {
    render(<LockstockPayment />);

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Pay for the capacity you need.Keep control of every movement."
    );
    expect(screen.getByRole("heading", { name: "15-day Starter trial" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Start free trial" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "Start free trial" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Continue to secure checkout" })).toHaveLength(3);
  });
});
