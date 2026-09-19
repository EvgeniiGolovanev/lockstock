// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";

const { start, finish, load, complete, replace } = vi.hoisted(() => ({ start: vi.fn(), finish: vi.fn(), load: vi.fn(), complete: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/auth/google", () => ({ startGoogleSignIn: start, finishGoogleSignIn: finish, loadGoogleOnboarding: load, completeGoogleOnboarding: complete }));
vi.mock("@/components/language-provider", () => ({ useLanguage: () => ({ locale: "en" }) }));
vi.mock("@/components/landing-header", () => ({ LandingHeader: () => <header>LockStock</header> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { GoogleAuth } from "@/components/google-auth";

describe("Google sign-in UI", () => {
  beforeEach(() => { vi.resetAllMocks(); window.history.replaceState(null, "", "/"); });
  afterEach(cleanup);
  it("prevents duplicate redirects and announces provider failures", async () => {
    start.mockRejectedValue(new Error("provider disabled"));
    render(<GoogleSignInButton />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button"));
    expect(start).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("alert")).toHaveTextContent("Google sign-in could not be completed");
    expect(screen.getByRole("button")).toBeEnabled();
  });
  it("finishes a callback once in Strict Mode and scrubs credentials", async () => {
    window.history.replaceState(null, "", "/auth/callback#access_token=secret");
    finish.mockResolvedValue("/inventory");
    render(<StrictMode><GoogleAuth mode="callback" /></StrictMode>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/inventory"));
    expect(finish).toHaveBeenCalledTimes(1);
    expect(location.hash).toBe("");
  });
  it("offers a return to sign in after cancellation and removes provider errors", async () => {
    window.history.replaceState(null, "", "/auth/callback#error=access_denied");
    finish.mockRejectedValue(new Error("google.cancelled"));
    render(<GoogleAuth mode="callback" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("cancelled or denied");
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/?signin=1");
    expect(location.hash).toBe("");
  });
  it("lets a new user complete their company and select a paid plan", async () => {
    load.mockResolvedValue({ fullName: "Jane", company: "", onboardingMode: "trial", selectedPlan: "starter" });
    complete.mockResolvedValue("/payment?onboarding=paid&plan=business");
    render(<GoogleAuth mode="onboarding" />);
    fireEvent.change(await screen.findByLabelText("Company Name"), { target: { value: "Factory" } });
    fireEvent.change(screen.getByLabelText("Start with"), { target: { value: "paid" } });
    fireEvent.change(screen.getByLabelText("Preferred plan"), { target: { value: "business" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/payment?onboarding=paid&plan=business"));
    expect(complete).toHaveBeenCalledWith({ fullName: "Jane", company: "Factory", onboardingMode: "paid", selectedPlan: "business" });
  });
  it("keeps entered details and allows retry after an onboarding failure", async () => {
    load.mockResolvedValue({ fullName: "Jane", company: "Factory", onboardingMode: "trial", selectedPlan: "starter" });
    complete.mockRejectedValue(new Error("offline"));
    render(<GoogleAuth mode="onboarding" />);
    fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("setup could not be completed");
    expect(screen.getByLabelText("Company Name")).toHaveValue("Factory");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });
});
