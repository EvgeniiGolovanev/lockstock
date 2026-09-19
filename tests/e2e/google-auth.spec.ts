import { test, expect, type Page } from "@playwright/test";

// Exercise the real Supabase browser SDK. Only the external provider/Auth HTTP
// responses and application APIs are fixtures; no live Google credentials.
async function googleProvider(page: Page, existing: boolean) {
  const user = { id: "google-user", aud: "authenticated", role: "authenticated", email: "google@example.com", app_metadata: { provider: "google" }, user_metadata: { full_name: "Jane Doe" }, created_at: new Date().toISOString() };
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.test`;
  const calls = { trial: 0, checkout: [] as Record<string, unknown>[], updates: [] as Record<string, unknown>[] };
  await page.addInitScript(() => { localStorage.setItem("lockstock.locale", "en"); });
  await page.route("**/auth/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/authorize")) {
      expect(url.searchParams.get("provider")).toBe("google");
      const callback = url.searchParams.get("redirect_to");
      expect(callback).toMatch(/\/auth\/callback$/);
      return route.fulfill({ status: 302, headers: { location: `${callback}#access_token=${token}&refresh_token=refresh&expires_in=3600&token_type=bearer` } });
    }
    if (url.pathname.endsWith("/user")) {
      if (request.method() === "PUT") calls.updates.push(request.postDataJSON());
      return route.fulfill({ json: user });
    }
    return route.fulfill({ status: 400, json: { message: "Unexpected Auth request" } });
  });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/organizations") return route.fulfill({ json: { data: existing || calls.trial ? [{ role: "owner", organization: { id: "my-org", name: "Factory" } }] : [] } });
    if (path === "/api/billing/start-trial") {
      expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
      calls.trial++;
      return route.fulfill({ json: { data: { orgId: "my-org" } } });
    }
    if (path === "/api/billing/checkout-session") {
      expect(route.request().headers()["x-org-id"]).toBeUndefined();
      calls.checkout.push(route.request().postDataJSON());
      return route.fulfill({ json: { data: { orgId: "paid-org", url: `${new URL(route.request().url()).origin}/payment?checkout=success` } } });
    }
    return route.fulfill({ json: { data: [] } });
  });
  return calls;
}

test("existing Google user returns to payment and keeps a persisted session", async ({ page }) => {
  const calls = await googleProvider(page, true);
  await page.goto("/payment?interval=annual");
  await page.evaluate(() => localStorage.setItem("lockstock.orgId", "old-user-org"));
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/\/payment\?interval=annual$/);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("lockstock.orgId"))).toBe("my-org");
  await page.reload();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  expect(calls.trial).toBe(0); expect(calls.updates).toHaveLength(0);
});

test("new Google user completes onboarding and starts a trial once", async ({ page }) => {
  const calls = await googleProvider(page, false);
  await page.goto("/?signin=1");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/\/auth\/complete$/);
  await expect(page.getByLabel("Full Name")).toHaveValue("Jane Doe");
  expect(calls.trial).toBe(0);
  await page.reload();
  await page.getByLabel("Company Name").fill("Factory");
  await page.screenshot({ path: test.info().outputPath("google-onboarding.png"), fullPage: true });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  expect(calls.trial).toBe(1);
  expect(calls.updates[0]).toMatchObject({ data: { company: "Factory", onboarding_mode: "trial" } });
  expect(await page.evaluate(() => localStorage.getItem("lockstock.orgId"))).toBe("my-org");
});

test("French mobile callback handles cancellation without exposing credentials", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("lockstock.locale", "fr"));
  await page.goto("/auth/callback#error=access_denied&error_description=private-provider-error");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("annulée ou refusée");
  expect(new URL(page.url()).hash).toBe("");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: test.info().outputPath("google-cancelled-mobile.png"), fullPage: true });
  await page.getByRole("link", { name: "Retour à la connexion" }).click();
  await expect(page.getByRole("button", { name: "Continuer avec Google" })).toBeEnabled();
});

test("new paid signup preserves the annual interval and never starts a trial", async ({ page }) => {
  const calls = await googleProvider(page, false);
  await page.goto("/payment?interval=annual");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/\/auth\/complete$/);
  await page.getByLabel("Company Name").fill("Factory");
  await expect(page.getByLabel("Start with")).toHaveValue("paid");
  await page.getByLabel("Preferred plan").selectOption("business");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/payment\?onboarding=paid&plan=business&interval=annual$/);
  expect(calls.trial).toBe(0);
  expect(calls.updates[0]).toMatchObject({ data: { selected_plan: "business", onboarding_mode: "paid" } });
  await page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Business", exact: true }) }).getByRole("button").click();
  await expect(page).toHaveURL(/\/payment\?checkout=success$/);
  expect(calls.checkout).toEqual([{ plan: "business", interval: "annual" }]);
  expect(await page.evaluate(() => localStorage.getItem("lockstock.orgId"))).toBe("paid-org");
});
