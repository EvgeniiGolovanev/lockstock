import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PasswordRecovery } from "@/components/password-recovery";
import { StrictMode } from "react";
const { reset, open, update, signOut } = vi.hoisted(() => ({ reset: vi.fn(), open: vi.fn(), update: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/language-provider", () => ({ useLanguage: () => ({ locale: "en", setLocale: vi.fn() }) }));
vi.mock("@/lib/supabase-browser", () => ({ getSupabaseBrowserClient: () => ({ auth: { resetPasswordForEmail: reset } }) }));
vi.mock("@/lib/auth/password-recovery", () => ({ openRecoverySession: open }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/reset-password#type=recovery&access_token=secret");
  reset.mockResolvedValue({ error: null });
  open.mockResolvedValue({ auth: { updateUser: update, signOut } });
  update.mockResolvedValue({ error: null });
  signOut.mockResolvedValue({ error: null });
});
it("provides the landing page header and working destinations", () => {
  render(<PasswordRecovery mode="request" />);
  const header = within(screen.getByRole("banner"));
  expect(header.getByText("LockStock")).toBeInTheDocument();
  expect(header.getByRole("link", { name: "Features" })).toHaveAttribute("href", "/#features");
  expect(header.getByRole("link", { name: "Benefits" })).toHaveAttribute("href", "/#benefits");
  expect(header.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
  expect(header.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  expect(header.getByRole("button", { name: "Get Started" })).toBeInTheDocument();
});
it("requests mail and gives a neutral confirmation", async () => {
  render(<PasswordRecovery mode="request" />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  expect(await screen.findByRole("status")).toHaveTextContent("If an account exists");
  expect(reset).toHaveBeenCalledWith("person@example.com", { redirectTo: `${window.location.origin}/reset-password` });
});
it("shows a safe delivery failure without exposing provider details", async () => {
  reset.mockRejectedValue(new Error("private provider details"));
  render(<PasswordRecovery mode="request" />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  expect(await screen.findByRole("alert")).not.toHaveTextContent("private provider details");
});
it("rejects an invalid link and removes credentials from the URL", async () => {
  open.mockRejectedValue(new Error("expired"));
  render(<PasswordRecovery mode="reset" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("invalid or expired");
  expect(window.location.hash).toBe("");
  expect(screen.queryByLabelText("New password")).toBeNull();
});
it("blocks mismatched passwords then saves and ends the recovery session", async () => {
  render(<PasswordRecovery mode="reset" />);
  fireEvent.change(await screen.findByLabelText("New password"), { target: { value: "new-password-123" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "different-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Save password" }));
  expect(screen.getByRole("alert")).toHaveTextContent("do not match");
  expect(update).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "new-password-123" } });
  fireEvent.click(screen.getByRole("button", { name: "Save password" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith({ password: "new-password-123" }));
  expect(await screen.findByText("Password updated. Sign in with your new password.")).toBeInTheDocument();
  expect(signOut).toHaveBeenCalledWith({ scope: "local" });
});
it("keeps one recovery initialization during Strict Mode effect replay", async () => {
  render(<StrictMode><PasswordRecovery mode="reset" /></StrictMode>);
  await screen.findByLabelText("New password");
  expect(open).toHaveBeenCalledTimes(1);
});
it("keeps the form available after a rejected password update", async () => {
  update.mockResolvedValue({ error: new Error("same password") });
  render(<PasswordRecovery mode="reset" />);
  fireEvent.change(await screen.findByLabelText("New password"), { target: { value: "password-123" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "password-123" } });
  fireEvent.click(screen.getByRole("button", { name: "Save password" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save");
  expect(signOut).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Save password" })).toBeEnabled();
});
it("shows generic feedback for a provider error response", async () => {
  reset.mockResolvedValue({ error: new Error("rate limited") });
  render(<PasswordRecovery mode="request" />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to request");
});
