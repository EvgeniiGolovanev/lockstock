import { test, expect } from "@playwright/test";

test("recovery pages support request, isolated reset, and return to sign in", async ({ page }) => {
  const user = { id: "recovery-user", aud: "authenticated", role: "authenticated", email: "recovery@example.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const jwtPart = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${jwtPart({ alg: "HS256", typ: "JWT" })}.${jwtPart({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.test`;
  let savedPassword = "";
  let loggedOut = false;
  await page.addInitScript(() => localStorage.setItem("lockstock.locale", "en"));
  await page.route("**/auth/v1/**", async route => {
    const request = route.request();
    if (request.url().includes("/recover")) {
      expect(new URL(request.url()).searchParams.get("redirect_to")).toContain("/reset-password");
      expect(request.postDataJSON().email).toBe(user.email);
      return route.fulfill({ json: {} });
    }
    if (request.url().includes("/logout")) {
      loggedOut = true;
      return route.fulfill({ json: {} });
    }
    if (request.url().includes("/user")) {
      if (request.method() === "PUT") savedPassword = request.postDataJSON().password;
      return route.fulfill({ json: user });
    }
    return route.fulfill({ status: 400, json: { message: "Unexpected auth call" } });
  });
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists");

  // Keep a separate persisted login intact when a different account follows recovery.
  await page.evaluate(() => localStorage.setItem("sb-127-auth-token", "other-account-sentinel"));
  await page.goto(`/reset-password#type=recovery&access_token=${token}&refresh_token=test-refresh`);
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
  await page.getByLabel("New password", { exact: true }).fill("new-password-123");
  await page.getByLabel("Confirm password", { exact: true }).fill("new-password-123");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByRole("status")).toContainText("Password updated");
  expect(savedPassword).toBe("new-password-123");
  expect(loggedOut).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("sb-127-auth-token"))).toBe("other-account-sentinel");
  await page.evaluate(() => localStorage.removeItem("sb-127-auth-token"));
  await page.getByRole("link", { name: "Back to sign in" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
});

test("expired links offer a new request in French on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("lockstock.locale", "fr"));
  await page.goto("/reset-password#error=access_denied&error_code=otp_expired");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Ce lien est invalide ou a expiré");
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByRole("link", { name: "Demander un nouveau lien" }).click();
  await expect(page.getByRole("button", { name: "Envoyer le lien" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
