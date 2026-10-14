import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { test, expect } from "./fixtures";

type Mail = { HTML: string; Text: string };
async function deliveredMail(email: string): Promise<Mail> {
  const inboxUrl = process.env.INVENTORY_MAILPIT_URL!;
  expect(new URL(inboxUrl).hostname).toBe("127.0.0.1");
  let mail: Mail | undefined;
  await expect.poll(async () => {
    const response = await fetch(`${inboxUrl}/api/v1/messages`);
    expect(response.ok).toBeTruthy();
    const inbox = await response.json();
    const found = inbox.messages.find((entry: { To: Array<{ Address: string }> }) => entry.To.some(to => to.Address === email));
    if (found) mail = await fetch(`${inboxUrl}/api/v1/message/${found.ID}`).then(response => response.json());
    return Boolean(mail);
  }).toBe(true);
  return mail!;
}

function verificationLink(mail: Mail) {
  const link = mail.HTML.match(/href="([^"]+)"/)?.[1] ?? mail.Text.match(/https?:\/\/\S+/)?.[0];
  expect(link).toBeTruthy();
  const url = new URL(link!.replaceAll("&amp;", "&"));
  expect(url.origin).toBe(new URL(process.env.INVENTORY_SUPABASE_URL!).origin);
  expect(url.pathname).toBe("/auth/v1/verify");
  return url.href;
}

test("real signup confirmation delivers mail and activates only the confirmed account", async ({ inventory, page, baseURL }) => {
  const email = `signup-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  const auth = createClient(process.env.INVENTORY_SUPABASE_URL!, process.env.INVENTORY_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await auth.auth.signUp({ email, password, options: { emailRedirectTo: `${baseURL}/payment` } });
  expect(signed.error).toBeNull();
  expect(signed.data.session).toBeNull();
  expect((await auth.auth.signInWithPassword({ email, password })).error).not.toBeNull();
  const link = verificationLink(await deliveredMail(email));
  await page.goto(link);
  await expect(page).toHaveURL(/\/payment/);
  expect((await auth.auth.signInWithPassword({ email, password })).error).toBeNull();
  const confirmed = await inventory.db.auth.admin.getUserById(signed.data.user!.id);
  expect(confirmed.data.user?.email_confirmed_at).toBeTruthy();
});

test("real recovery mail resets the password, removes URL credentials and rejects a consumed link", async ({ inventory, page }) => {
  const password = `Changed-${randomUUID()}!`;
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(inventory.email);
  await page.getByRole("button", { name: "Send reset link", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "If an account exists" })).toBeVisible();
  const mail = await deliveredMail(inventory.email);
  expect(mail.HTML + mail.Text).not.toMatch(/Alternatively, enter the code/i);
  const link = verificationLink(mail);
  await page.goto(link);
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/reset-password");
  expect(new URL(page.url()).hash).toBe("");
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Save password", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Password updated" })).toBeVisible();
  const auth = createClient(process.env.INVENTORY_SUPABASE_URL!, process.env.INVENTORY_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  expect((await auth.auth.signInWithPassword({ email: inventory.email, password: inventory.password })).error).not.toBeNull();
  expect((await auth.auth.signInWithPassword({ email: inventory.email, password })).error).toBeNull();
  await page.goto(link);
  await expect(page.getByRole("main").getByRole("alert").filter({ hasText: "invalid or expired" })).toBeVisible();
});
