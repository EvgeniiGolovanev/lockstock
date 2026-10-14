import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { test, expect } from "./fixtures";

test("durable contact limiter is shared across clients, hashed and service-role only", async ({ inventory }) => {
  const subject = `127.0.0.1:rate-${randomUUID()}@example.test`;
  const second = createClient(process.env.INVENTORY_SUPABASE_URL!, process.env.INVENTORY_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const results = await Promise.all(Array.from({ length: 8 }, (_, index) => (index % 2 ? inventory.db : second)
    .rpc("consume_public_rate_limit", { p_scope: "contact", p_subject: subject }).single()));
  results.forEach(result => expect(result.error).toBeNull());
  const rows = results.map(result => result.data as { allowed: boolean; retry_after_seconds: number });
  expect(rows.filter(row => row.allowed)).toHaveLength(5);
  expect(rows.filter(row => !row.allowed)).toHaveLength(3);
  rows.filter(row => !row.allowed).forEach(row => expect(row.retry_after_seconds).toBeGreaterThan(0));
  const hash = createHash("sha256").update(subject).digest("hex");
  const stored = await inventory.db.from("public_rate_limits").select("subject_hash,request_count").eq("scope", "contact").eq("subject_hash", hash).single();
  expect(stored.error).toBeNull();
  expect(stored.data).toEqual({ subject_hash: hash, request_count: 8 });
  const userClient = createClient(process.env.INVENTORY_SUPABASE_URL!, process.env.INVENTORY_ANON_KEY!, { global: { headers: { authorization: `Bearer ${inventory.token}` } }, auth: { persistSession: false } });
  const forbidden = await userClient.rpc("consume_public_rate_limit", { p_scope: "contact", p_subject: subject });
  expect(forbidden.error).not.toBeNull();
  const anon = createClient(process.env.INVENTORY_SUPABASE_URL!, process.env.INVENTORY_ANON_KEY!, { auth: { persistSession: false } });
  expect((await anon.rpc("consume_public_rate_limit", { p_scope: "contact", p_subject: subject })).error).not.toBeNull();
});

test("real contact route fails clearly without mail credentials and returns 429 with Retry-After", async ({ inventory }) => {
  const email = `contact-${randomUUID()}@example.test`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const result = await inventory.request.post("/api/contact", { data: { name: "Disposable tester", email, message: "Local delivery configuration check." } });
    expect(result.status(), await result.text()).toBe(attempt < 5 ? 503 : 429);
    const body = await result.json();
    expect(body.error).not.toBe("Unexpected server error.");
    if (attempt === 5) expect(Number(result.headers()["retry-after"])).toBeGreaterThan(0);
  }
});

test("real contact route fails closed when the durable limiter cannot execute", async ({ inventory }) => {
  const project = process.env.INVENTORY_DISPOSABLE_PROJECT!;
  if (!/^lockstock-db-verification-\d+$/.test(project)) throw new Error("Limiter failure probe requires the disposable verifier container.");
  const sql = (statement: string) => execFileSync(process.platform === "win32" ? "docker.exe" : "docker", [
    "exec", "-i", `supabase_db_${project}`, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"
  ], { input: statement, encoding: "utf8", windowsHide: true, timeout: 30_000 });
  try {
    sql("revoke execute on function public.consume_public_rate_limit(text,text) from service_role;");
    const response = await inventory.request.post("/api/contact", { data: { name: "Disposable tester", email: `unavailable-${randomUUID()}@example.test`, message: "Local rate limiter failure probe." } });
    expect(response.status(), await response.text()).toBe(503);
    expect((await response.json()).error).toBe("Rate limiting is temporarily unavailable.");
  } finally {
    sql("grant execute on function public.consume_public_rate_limit(text,text) to service_role;");
  }
});
