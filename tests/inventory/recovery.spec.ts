import { execFileSync } from "node:child_process";
import { test, expect, materialInput } from "./fixtures";

test("local logical backup restores application rows, privileges and tenant isolation into a separate database", async ({ inventory }) => {
  test.setTimeout(180_000);
  const project = process.env.INVENTORY_DISPOSABLE_PROJECT!;
  if (!/^lockstock-db-verification-\d+$/.test(project)) throw new Error("Restore drill requires the disposable verifier container.");
  const container = `supabase_db_${project}`;
  const database = "lockstock_restore_drill";
  const backup = "/tmp/lockstock-restore-drill.dump";
  const run = (args: string[], input?: string) => execFileSync(process.platform === "win32" ? "docker.exe" : "docker", [
    "exec", "-i", container, "sh", "-c", 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec "$@"', "--", ...args
  ], {
    encoding: "utf8", input, windowsHide: true, timeout: 120_000, maxBuffer: 16 * 1024 * 1024
  }).trim();
  const sql = (db: string, statement: string) => run(["psql", "-U", "supabase_admin", "-d", db, "-v", "ON_ERROR_STOP=1", "-At"], statement);
  const { materials: [material], locations: [location] } = await inventory.catalog();
  await inventory.post("/stock/movements", { material_id: material.id, location_id: location.id, reason: "adjustment", quantity_delta: 17 });
  const other = await inventory.actor();
  await other.post("/materials", materialInput("RESTORE-OTHER"));
  const tables = ["auth.users", ...["organizations", "teams", "user_profiles", "materials", "locations", "suppliers", "org_users", "team_members", "org_invitations", "organization_billing", "inventory_balances", "stock_movements", "purchase_orders", "po_lines", "audit_log"].map(table => `public.${table}`)];
  const digest = (db: string, table: string) => sql(db, `select md5(coalesce(string_agg(row_to_json(t)::text, '' order by row_to_json(t)::text), '')) from ${table} t;`);
  const before = Object.fromEntries(tables.map(table => [table, digest("postgres", table)]));
  const started = Date.now();
  try {
    run(["pg_dump", "-U", "supabase_admin", "-d", "postgres", "--format=custom", "--schema=public", "--schema=auth", "--file", backup]);
    run(["createdb", "-U", "supabase_admin", "--template=template0", database]);
    // Extensions installed in the source's extensions schema are dependencies
    // of the application schema; schema-filtered pg_dump omits CREATE EXTENSION.
    sql(database, 'drop schema public; create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions; create extension if not exists "uuid-ossp" with schema extensions;');
    run(["pg_restore", "-U", "supabase_admin", "--exit-on-error", "--dbname", database, backup]);
    expect(Object.fromEntries(tables.map(table => [table, digest(database, table)]))).toEqual(before);
    const isolated = sql(database, `begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${inventory.userId}","role":"authenticated"}', true); select count(*) from public.materials where org_id='${other.orgId}'; select count(*) from public.materials where org_id='${inventory.orgId}'; rollback;`);
    expect(isolated.split(/\r?\n/).slice(-3)).toEqual(["0", "2", "ROLLBACK"]);
    expect(sql(database, `select has_function_privilege('authenticated', 'public.consume_public_rate_limit(text,text)', 'execute');`)).toBe("f");
    console.log(`Local logical restore drill passed in ${Date.now() - started} ms. Snapshot data preserved; writes after the snapshot are outside its recovery point.`);
  } finally {
    run(["dropdb", "-U", "supabase_admin", "--if-exists", database]);
    run(["rm", "-f", backup]);
  }
});
