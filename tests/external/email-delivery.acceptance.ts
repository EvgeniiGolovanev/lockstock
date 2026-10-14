import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import { POST as createOrganization } from "@/app/api/organizations/route";
import { POST as createInvitation } from "@/app/api/organizations/[id]/members/route";

it("sends an actual invitation to the explicitly selected test recipient", async () => {
  const recipient = process.env.LOCKSTOCK_EXTERNAL_EMAIL_RECIPIENT;
  if (!recipient || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) throw new Error("Set LOCKSTOCK_EXTERNAL_EMAIL_RECIPIENT to an explicitly authorized test inbox.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (new URL(url).hostname !== "127.0.0.1") throw new Error("External email acceptance creates fixtures only in local Supabase.");
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error("Configure Resend and EMAIL_FROM before external email acceptance.");
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, options);
  const auth = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, options);
  const email = `email-delivery-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
  expect(created.error).toBeNull();
  let orgId: string | undefined;
  try {
    const session = await auth.auth.signInWithPassword({ email, password });
    expect(session.error).toBeNull();
    const token = session.data.session!.access_token;
    const name = `LockStock delivery test ${new Date().toISOString()} (temporary local workspace)`;
    const organization = await createOrganization(new NextRequest("http://127.0.0.1:3000/api/organizations", {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ name, plan: "business" })
    }));
    expect(organization.status).toBe(201);
    orgId = (await organization.json()).data.id;
    const invitation = await createInvitation(new NextRequest(`http://127.0.0.1:3000/api/organizations/${orgId}/members`, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "x-org-id": orgId!, "content-type": "application/json" }, body: JSON.stringify({ email: recipient, role: "viewer" })
    }), { params: Promise.resolve({ id: orgId! }) });
    const result = await invitation.json();
    expect(invitation.status).toBe(201);
    expect(result.data.email_delivery, result.data.email_delivery_message).toBe("sent");
    console.log("Invitation accepted by the real email provider. Inbox receipt must be confirmed separately.");
  } finally {
    if (orgId) expect((await db.from("organizations").delete().eq("id", orgId)).error).toBeNull();
    expect((await db.auth.admin.deleteUser(created.data.user!.id)).error).toBeNull();
  }
});
