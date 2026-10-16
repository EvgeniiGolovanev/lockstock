import { test, expect, type InventoryFixture } from "./fixtures";
import type { Page } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`member feedback recovers real mutations without replay at ${width}px`, async ({ inventory: owner, page, browser }, testInfo) => {
    test.setTimeout(360_000);
    const actor = await owner.actor();
    const actorPage = await browser.newPage({ viewport: { width, height: 900 } });
    await page.setViewportSize({ width, height: 900 });
    const counts = new Map<string, number>();
    const errors: string[] = [];
    let ownerReadFailure = "", actorReadFailure = "";
    for (const target of [page, actorPage]) {
      target.on("pageerror", error => errors.push(error.message));
      target.on("request", request => {
        if (["POST", "PATCH", "DELETE"].includes(request.method())) {
          const key = `${request.method()} ${new URL(request.url()).pathname}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      });
      await target.route("**/api/**", async route => {
        const fail = target === page ? ownerReadFailure : actorReadFailure;
        if (fail && route.request().method() === "GET" && new URL(route.request().url()).pathname === fail) {
          await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Read unavailable" }) });
        } else await route.continue();
      });
    }
    const response = (target: Page, method: string, path: string) => target.waitForResponse(r => r.request().method() === method && new URL(r.url()).pathname === path);
    const membership = async () => {
      const result = await owner.db.from("org_users").select("role").eq("org_id", owner.orgId).eq("user_id", actor.userId);
      expect(result.error).toBeNull(); return result.data;
    };
    const role = async (who: InventoryFixture, next: "owner" | "member" | "manager") => {
      const result = await owner.db.from("org_users").update({ role: next }).eq("org_id", owner.orgId).eq("user_id", who.userId);
      expect(result.error).toBeNull();
    };
    const snapshot = async () => {
      const org = await owner.db.from("organizations").select("*").eq("id", owner.orgId);
      expect(org.error).toBeNull();
      const tables = ["org_users", "org_invitations", "audit_log", "teams"] as const;
      const rows = await Promise.all(tables.map(async table => {
        const result = await owner.db.from(table).select("*").eq("org_id", owner.orgId);
        expect(result.error).toBeNull();
        return [table, result.data!.map(row => JSON.stringify(row)).sort()] as const;
      }));
      const teams = await owner.db.from("teams").select("id").eq("org_id", owner.orgId);
      expect(teams.error).toBeNull();
      const members = await owner.db.from("team_members").select("*").in("team_id", teams.data!.map(team => team.id));
      expect(members.error).toBeNull();
      return { org: org.data, ...Object.fromEntries(rows), teamMembers: members.data!.map(row => JSON.stringify(row)).sort() };
    };
    const expiry = async (id: string, expired: boolean) => {
      const result = await owner.db.from("org_invitations").update({ expires_at: new Date(Date.now() + (expired ? -60_000 : 86_400_000)).toISOString() }).eq("id", id);
      expect(result.error).toBeNull();
    };
    const warning = (target: Page) => target.getByRole("alert").filter({ hasText: "The operation completed" });
    const assertRecovery = async (target: Page) => {
      await expect(warning(target)).toBeVisible();
      const beforeCounts = new Map(counts), before = await snapshot();
      if (target === page) ownerReadFailure = ""; else actorReadFailure = "";
      await target.getByRole("button", { name: "Refresh data", exact: true }).click();
      await expect(warning(target)).toHaveCount(0);
      expect(counts).toEqual(beforeCounts);
      expect(await snapshot()).toEqual(before);
    };
    try {
      await owner.login(page); await page.goto("/members"); await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "Rename Group", exact: true }).click();
      const renamed = `Member feedback ${width}`;
      await page.getByRole("textbox", { name: "Rename group", exact: true }).fill(renamed);
      await role(owner, "manager");
      let before = await snapshot(), pending = response(page, "PATCH", `/api/organizations/${owner.orgId}`);
      await page.getByRole("button", { name: "Save Group Name", exact: true }).click();
      expect((await pending).status()).toBe(403);
      await expect(page.getByRole("alert").filter({ hasText: "permission" })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Rename group", exact: true })).toHaveValue(renamed);
      expect(await snapshot()).toEqual(before);
      await role(owner, "owner"); ownerReadFailure = "/api/organizations";
      pending = response(page, "PATCH", `/api/organizations/${owner.orgId}`);
      await page.getByRole("button", { name: "Save Group Name", exact: true }).click();
      expect((await pending).status()).toBe(200); await assertRecovery(page);

      await page.getByRole("textbox", { name: "Invite by email", exact: true }).fill(actor.email);
      await page.getByRole("combobox", { name: "Assigned role", exact: true }).selectOption("member");
      await role(owner, "manager"); before = await snapshot();
      pending = response(page, "POST", `/api/organizations/${owner.orgId}/members`);
      await page.getByRole("button", { name: "Send Invitation", exact: true }).click();
      expect((await pending).status()).toBe(403);
      const denied = page.getByRole("alert").filter({ hasText: "permission" });
      await expect(denied).toBeVisible(); await denied.scrollIntoViewIfNeeded(); await expect(denied).toBeInViewport();
      await expect(page.getByRole("textbox", { name: "Invite by email", exact: true })).toHaveValue(actor.email);
      expect(await snapshot()).toEqual(before);
      await page.screenshot({ path: testInfo.outputPath(`member-error-${width}.png`), fullPage: true });
      await role(owner, "owner"); ownerReadFailure = `/api/organizations/${owner.orgId}/members`;
      pending = response(page, "POST", `/api/organizations/${owner.orgId}/members`);
      await page.getByRole("button", { name: "Send Invitation", exact: true }).click();
      const sent = await pending; expect(sent.status()).toBe(201);
      const invitation = (await sent.json()).data;
      expect(invitation.email_delivery).toBe("skipped");
      await expect(page.getByRole("status")).toContainText("Invitation created. Email delivery skipped.");
      await expect(page.getByRole("button", { name: "Send Invitation", exact: true })).toBeDisabled();
      await assertRecovery(page);
      expect((await owner.rows("org_invitations")).filter(row => row.status === "pending")).toHaveLength(1);

      await actor.login(actorPage); await actorPage.goto("/members"); await actorPage.waitForLoadState("networkidle");
      await expiry(invitation.id, true); before = await snapshot();
      pending = response(actorPage, "POST", `/api/invitations/${invitation.id}/accept`);
      await actorPage.getByRole("button", { name: "Accept", exact: true }).click();
      expect((await pending).status()).toBe(404);
      await expect(actorPage.getByRole("alert").filter({ hasText: /./ })).toBeVisible();
      expect(await snapshot()).toEqual(before);
      await expiry(invitation.id, false); actorReadFailure = "/api/organizations";
      pending = response(actorPage, "POST", `/api/invitations/${invitation.id}/accept`);
      await actorPage.getByRole("button", { name: "Accept", exact: true }).click();
      expect((await pending).status()).toBe(200);
      await expect(warning(actorPage)).toBeVisible();
      for (const button of await actorPage.getByRole("button", { name: "Open Group", exact: true }).all()) await expect(button).toBeDisabled();
      await assertRecovery(actorPage); expect(await membership()).toEqual([{ role: "member" }]);

      await page.getByRole("button", { name: "Refresh Members", exact: true }).click();
      const memberRow = page.getByRole("row").filter({ hasText: actor.email }).filter({ has: page.getByRole("button", { name: "Remove", exact: true }) });
      await expect(memberRow).toBeVisible(); await role(owner, "manager"); before = await snapshot();
      pending = response(page, "DELETE", `/api/organizations/${owner.orgId}/members/${actor.userId}`);
      await memberRow.getByRole("button", { name: "Remove", exact: true }).click();
      expect((await pending).status()).toBe(403); await expect(page.getByRole("alert").filter({ hasText: "permission" })).toBeVisible();
      expect(await snapshot()).toEqual(before);
      await role(owner, "owner"); ownerReadFailure = `/api/organizations/${owner.orgId}/members`;
      pending = response(page, "DELETE", `/api/organizations/${owner.orgId}/members/${actor.userId}`);
      await memberRow.getByRole("button", { name: "Remove", exact: true }).click();
      expect((await pending).status()).toBe(200); await assertRecovery(page); expect(await membership()).toEqual([]);

      const rejected = await owner.post<{ id: string }>(`/organizations/${owner.orgId}/members`, { email: actor.email, role: "member" });
      await actorPage.reload(); await actorPage.waitForLoadState("networkidle");
      await expiry(rejected.id, true); before = await snapshot();
      pending = response(actorPage, "POST", `/api/invitations/${rejected.id}/reject`);
      await actorPage.getByRole("button", { name: "Reject", exact: true }).click();
      expect((await pending).status()).toBe(404); await expect(actorPage.getByRole("alert").filter({ hasText: /./ })).toBeVisible();
      expect(await snapshot()).toEqual(before);
      await expiry(rejected.id, false); actorReadFailure = "/api/invitations/pending";
      pending = response(actorPage, "POST", `/api/invitations/${rejected.id}/reject`);
      await actorPage.getByRole("button", { name: "Reject", exact: true }).click();
      expect((await pending).status()).toBe(200); await assertRecovery(actorPage); expect(await membership()).toEqual([]);

      const joined = await owner.post<{ id: string }>(`/organizations/${owner.orgId}/members`, { email: actor.email, role: "member" });
      const accepted = await actor.request.post(`/api/invitations/${joined.id}/accept`, { headers: actor.headers() });
      expect(accepted.status()).toBe(200);
      await actorPage.reload(); await actorPage.waitForLoadState("networkidle");
      await actorPage.getByRole("button", { name: "Leave group", exact: true }).click();
      const leave = actorPage.getByRole("dialog", { name: "Leave group", exact: true });
      await role(actor, "owner"); before = await snapshot();
      pending = response(actorPage, "POST", `/api/organizations/${owner.orgId}/leave`);
      await leave.getByRole("button", { name: "Leave group", exact: true }).click();
      expect((await pending).status()).toBe(403); await expect(leave.getByRole("alert")).toBeVisible();
      expect(await snapshot()).toEqual(before);
      await role(actor, "member"); actorReadFailure = "/api/organizations";
      pending = response(actorPage, "POST", `/api/organizations/${owner.orgId}/leave`);
      await leave.getByRole("button", { name: "Leave group", exact: true }).click();
      expect((await pending).status()).toBe(200); await expect(leave).toBeHidden(); await assertRecovery(actorPage);
      expect(await membership()).toEqual([]); expect(errors).toEqual([]);
    } finally { await actorPage.close(); }
  });
}
