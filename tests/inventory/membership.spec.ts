import { test, expect, type InventoryFixture } from "./fixtures";

async function invite(owner: InventoryFixture, actor: InventoryFixture, role = "member") {
  const invitation = await owner.post<{ id: string; email_delivery: string }>(`/organizations/${owner.orgId}/members`, { email: actor.email, role });
  // This isolated app has no provider credentials and sends no external mail.
  expect(invitation.email_delivery).toBe("skipped");
  return invitation.id;
}

async function accept(owner: InventoryFixture, actor: InventoryFixture, role = "member") {
  const id = await invite(owner, actor, role);
  const response = await actor.request.post(`/api/invitations/${id}/accept`, { headers: actor.headers() });
  expect(response.status(), await response.text()).toBe(200);
  expect((await response.json()).data).toMatchObject({ org_id: owner.orgId, membership_role: role });
  return id;
}

async function membership(owner: InventoryFixture, actor: InventoryFixture) {
  const { data, error } = await owner.db.from("org_users").select("role").eq("org_id", owner.orgId).eq("user_id", actor.userId);
  expect(error).toBeNull();
  return data;
}

async function teamMemberships(owner: InventoryFixture, actor: InventoryFixture) {
  const { data: teams, error: teamError } = await owner.db.from("teams").select("id").eq("org_id", owner.orgId);
  expect(teamError).toBeNull();
  const { data, error } = await owner.db.from("team_members").select("team_id,user_id").eq("user_id", actor.userId).in("team_id", teams!.map(team => team.id));
  expect(error).toBeNull();
  return data;
}

test("real invitation acceptance, role changes and removal preserve tenant isolation", async ({ inventory: owner }) => {
  const actor = await owner.actor();
  const outsider = await owner.actor();
  const invitationId = await invite(owner, actor);
  const pending = await actor.request.get("/api/invitations/pending", { headers: actor.headers() });
  expect(pending.status()).toBe(200);
  expect((await pending.json()).data).toEqual(expect.arrayContaining([expect.objectContaining({ id: invitationId, direction: "received" })]));
  const foreign = await outsider.request.post(`/api/invitations/${invitationId}/accept`, { headers: outsider.headers() });
  expect(foreign.status()).toBe(404);
  const accepted = await actor.request.post(`/api/invitations/${invitationId}/accept`, { headers: actor.headers() });
  expect(accepted.status(), await accepted.text()).toBe(200);
  expect(await membership(owner, actor)).toEqual([{ role: "member" }]);
  expect(await teamMemberships(owner, actor)).toHaveLength(1);
  expect((await actor.request.post(`/api/invitations/${invitationId}/accept`, { headers: actor.headers() })).status()).toBe(404);

  const selfPromotion = await actor.request.patch(`/api/organizations/${owner.orgId}/members/${actor.userId}`, { headers: actor.headers(owner.orgId), data: { role: "owner" } });
  expect(selfPromotion.status()).toBe(403);
  expect(await membership(owner, actor)).toEqual([{ role: "member" }]);
  const changed = await owner.request.patch(`/api/organizations/${owner.orgId}/members/${actor.userId}`, { headers: owner.headers(), data: { role: "viewer" } });
  expect(changed.status(), await changed.text()).toBe(200);
  expect(await membership(owner, actor)).toEqual([{ role: "viewer" }]);
  expect((await actor.request.get("/api/materials", { headers: actor.headers(owner.orgId) })).status()).toBe(200);
  expect((await actor.request.post("/api/locations", { headers: actor.headers(owner.orgId), data: { name: "Forbidden" } })).status()).toBe(403);
  expect((await outsider.request.get(`/api/organizations/${owner.orgId}/members`, { headers: outsider.headers(owner.orgId) })).status()).toBe(403);
  const listed = await owner.request.get(`/api/organizations/${owner.orgId}/members`, { headers: owner.headers() });
  expect(listed.status()).toBe(200);
  expect((await listed.json()).data).toEqual(expect.arrayContaining([expect.objectContaining({ user_id: actor.userId, email: actor.email, role: "viewer" })]));

  const removed = await owner.request.delete(`/api/organizations/${owner.orgId}/members/${actor.userId}`, { headers: owner.headers() });
  expect(removed.status(), await removed.text()).toBe(200);
  expect(await membership(owner, actor)).toEqual([]);
  expect(await teamMemberships(owner, actor)).toEqual([]);
  expect(await membership(actor, actor)).toEqual([{ role: "owner" }]);
  expect((await actor.request.get("/api/materials", { headers: actor.headers(owner.orgId) })).status()).toBe(403);
});

test("superseded, rejected and expired invitations cannot create memberships", async ({ inventory: owner }) => {
  const actor = await owner.actor();
  const first = await invite(owner, actor);
  const second = await invite(owner, actor, "viewer");
  expect((await actor.request.post(`/api/invitations/${first}/accept`, { headers: actor.headers() })).status()).toBe(404);
  const rejected = await actor.request.post(`/api/invitations/${second}/reject`, { headers: actor.headers() });
  expect(rejected.status(), await rejected.text()).toBe(200);
  expect((await actor.request.post(`/api/invitations/${second}/accept`, { headers: actor.headers() })).status()).toBe(404);
  const third = await invite(owner, actor);
  const { error } = await owner.db.from("org_invitations").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", third);
  expect(error).toBeNull();
  expect((await actor.request.post(`/api/invitations/${third}/accept`, { headers: actor.headers() })).status()).toBe(404);
  expect(await membership(owner, actor)).toEqual([]);
});

test("self-leave removes only this workspace and owners remain protected", async ({ inventory: owner }) => {
  const actor = await owner.actor();
  await accept(owner, actor, "manager");
  expect((await owner.request.post(`/api/organizations/${owner.orgId}/leave`, { headers: owner.headers() })).status()).toBe(403);
  expect((await owner.request.delete(`/api/organizations/${owner.orgId}/members/${owner.userId}`, { headers: owner.headers() })).status()).toBe(400);
  expect((await owner.request.patch(`/api/organizations/${owner.orgId}/members/${owner.userId}`, { headers: owner.headers(), data: { role: "viewer" } })).status()).toBe(400);
  const left = await actor.request.post(`/api/organizations/${owner.orgId}/leave`, { headers: actor.headers(owner.orgId) });
  expect(left.status(), await left.text()).toBe(200);
  expect(await membership(owner, actor)).toEqual([]);
  expect(await teamMemberships(owner, actor)).toEqual([]);
  expect(await membership(actor, actor)).toEqual([{ role: "owner" }]);
  expect(await membership(owner, owner)).toEqual([{ role: "owner" }]);
  expect((await actor.request.get("/api/materials", { headers: actor.headers(owner.orgId) })).status()).toBe(403);
});

test("real browser sends and accepts an invitation, refreshes actions and leaves the group", async ({ inventory: owner, page, browser }) => {
  const actor = await owner.actor();
  const ownerPage = await browser.newPage();
  try {
    await owner.login(ownerPage);
    await ownerPage.getByRole("link", { name: "Members", exact: true }).click();
    await ownerPage.getByLabel("Invite by email", { exact: true }).fill(actor.email);
    await ownerPage.getByLabel("Assigned role").selectOption("member");
    const sent = ownerPage.waitForResponse(response => response.url().endsWith(`/organizations/${owner.orgId}/members`) && response.request().method() === "POST");
    await ownerPage.getByRole("button", { name: "Send Invitation", exact: true }).click();
    const result = await sent;
    expect(result.status(), await result.text()).toBe(201);
    expect((await result.json()).data.email_delivery).toBe("skipped");
  } finally { await ownerPage.close(); }
  await actor.login(page);
  await page.getByRole("link", { name: "Members", exact: true }).click();
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(page.getByRole("button", { name: "Accept", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);
  expect(await membership(owner, actor)).toEqual([{ role: "member" }]);
  await page.reload();
  await expect(page.getByRole("button", { name: "Leave group", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Leave group", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Leave group", exact: true });
  await dialog.getByRole("button", { name: "Leave group", exact: true }).click();
  await expect(page.getByRole("button", { name: "Leave group", exact: true })).toHaveCount(0);
  expect(await membership(owner, actor)).toEqual([]);
  expect(await teamMemberships(owner, actor)).toEqual([]);
});
