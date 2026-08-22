import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ locale: "en", setLocale: vi.fn() })
}));

import PrivacyPage from "@/app/privacy/page";
import SecurityPage from "@/app/security/page";
import TermsPage from "@/app/terms/page";

describe("legal pages", () => {
  afterEach(cleanup);

  it("publishes a privacy policy page with a direct route back to the terms", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Terms of Service" }).some((link) => link.getAttribute("href") === "/terms")).toBe(true);
  });

  it("publishes terms with a direct route back to privacy", () => {
    render(<TermsPage />);

    expect(screen.getByRole("heading", { name: "Terms of Service" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Privacy Policy" }).some((link) => link.getAttribute("href") === "/privacy")).toBe(true);
  });

  it("publishes a security reporting page with direct policy links", () => {
    render(<SecurityPage />);

    expect(screen.getByRole("heading", { name: "Security" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact LockStock" })).toHaveAttribute("href", "/contact");
    expect(screen.getAllByRole("link", { name: "Privacy Policy" }).some((link) => link.getAttribute("href") === "/privacy")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Terms of Service" }).some((link) => link.getAttribute("href") === "/terms")).toBe(true);
  });
});
