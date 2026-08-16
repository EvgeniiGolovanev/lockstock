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

vi.mock("next/navigation", () => ({
  usePathname: () => "/account",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}));

vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ locale: "en", setLocale: vi.fn() })
}));

vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />
}));

vi.mock("@/components/nav-item-icon", () => ({
  NavItemIcon: () => <svg data-testid="nav-icon" />
}));

vi.mock("@/lib/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: authMock })
}));

vi.mock("@/lib/ui/use-activity-log", () => ({
  useActivityLog: () => ({ addActivity: vi.fn() })
}));

import { LockstockAccount } from "@/components/lockstock-account";

function mockJsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body
  } as Response;
}

describe("LockstockAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem("lockstock.accessToken", "token");
    window.localStorage.setItem("lockstock.orgId", "org-1");
    authMock.getSession.mockResolvedValue({ data: { session }, error: null });
    authMock.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/organizations")) {
          return mockJsonResponse({
            data: [
              { role: "owner", organization: { id: "org-1", name: "Northstar Materials", created_at: "2026-08-01T09:00:00.000Z" } },
              { role: "manager", organization: { id: "org-2", name: "South Bay Logistics", created_at: "2026-08-02T09:00:00.000Z" } }
            ]
          });
        }

        if (url.includes("/api/billing/entitlements")) {
          return mockJsonResponse({
            data: {
              selectedPlan: "business",
              effectivePlan: "starter",
              isReadOnly: false,
              canExportAudit: true,
              features: { auditCsvExport: true }
            }
          });
        }

        if (url.includes("/api/billing/summary")) {
          return mockJsonResponse({
            data: {
              plan: "business",
              status: "trialing",
              billing_interval: "monthly",
              current_period_end: null,
              trial_ends_at: "2026-08-28T10:00:00.000Z",
              past_due_since: null,
              cancel_at_period_end: false,
              stripe_subscription_id: null,
              scheduled_plan: null,
              scheduled_interval: null,
              scheduled_effective_at: null
            }
          });
        }

        if (url.includes("/api/audit-log")) {
          return mockJsonResponse({ data: [] });
        }

        if (url.includes("/api/platform/me")) {
          return mockJsonResponse({ isPlatformAdmin: false, role: null });
        }

        if (url.includes("/api/account/profile")) {
          return mockJsonResponse({ data: { ok: true } });
        }

        return mockJsonResponse({ data: {} });
      })
    );
  });

  it("renders the subscription and audit sections for an owner with billing access", async () => {
    render(<LockstockAccount />);

    expect(await screen.findByRole("heading", { name: "Account" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Subscription" })).toBeInTheDocument();
    expect(screen.getByText("Current plan")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByText(
          (_, element) =>
            element?.tagName === "P" &&
            element.textContent?.includes("Selected plan: business. Current access: starter") === true
        )
      ).toBeInTheDocument();
    });
    expect(await screen.findByRole("button", { name: "Download CSV" })).toBeInTheDocument();
  });

  it("keeps the subscription section when the audit log request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/audit-log")) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ error: "Unexpected server error." }),
            text: async () => JSON.stringify({ error: "Unexpected server error." }),
            headers: { get: () => null }
          } as unknown as Response;
        }

        if (url.includes("/api/organizations")) {
          return mockJsonResponse({
            data: [
              { role: "owner", organization: { id: "org-1", name: "Northstar Materials", created_at: "2026-08-01T09:00:00.000Z" } }
            ]
          });
        }

        if (url.includes("/api/billing/entitlements")) {
          return mockJsonResponse({
            data: {
              selectedPlan: "business",
              effectivePlan: "starter",
              isReadOnly: false,
              canExportAudit: true,
              features: { auditCsvExport: true }
            }
          });
        }

        if (url.includes("/api/billing/summary")) {
          return mockJsonResponse({
            data: {
              plan: "business",
              status: "trialing",
              billing_interval: "monthly",
              current_period_end: null,
              trial_ends_at: "2026-08-28T10:00:00.000Z",
              past_due_since: null,
              cancel_at_period_end: false,
              stripe_subscription_id: null,
              scheduled_plan: null,
              scheduled_interval: null,
              scheduled_effective_at: null
            }
          });
        }

        if (url.includes("/api/account/profile")) {
          return mockJsonResponse({ data: { ok: true } });
        }

        return mockJsonResponse({ data: {} });
      })
    );

    render(<LockstockAccount />);

    expect(await screen.findByRole("heading", { name: "Subscription" })).toBeInTheDocument();
    expect(screen.getByText("Current plan")).toBeInTheDocument();
    expect(await screen.findByText("Unexpected server error.")).toBeInTheDocument();
  });
});
