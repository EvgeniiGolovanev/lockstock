import { spawn, execFileSync } from "node:child_process";
import { test, expect } from "./fixtures";

test("receipt completes while an adjustment waits for the replenishment boundary", async ({ inventory }) => {
  const project = process.env.INVENTORY_DISPOSABLE_PROJECT!;
  if (!/^lockstock-db-verification-\d+$/.test(project)) throw new Error("Requires disposable database");
  const docker = process.platform === "win32" ? "docker.exe" : "docker";
  const args = ["exec", "-i", `supabase_db_${project}`, "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"];
  const sql = (query: string) => execFileSync(docker, args, { input: query, encoding: "utf8", windowsHide: true, timeout: 30_000 }).trim();
  const catalog = await inventory.catalog();
  const material = catalog.materials[0], location = catalog.locations[0];
  const po = await inventory.createPo(catalog.suppliers[0], [{ material_id: material.id, quantity_ordered: 10 }]);
  await inventory.status(po, "sent");
  const sessionName = `receipt-${po.id}`;
  const connection = spawn(docker, args, { windowsHide: true });
  let output = "", errors = "";
  connection.stdout.on("data", chunk => { output += chunk; });
  connection.stderr.on("data", chunk => { errors += chunk; });
  const closed = new Promise<number | null>(resolve => connection.on("close", resolve));
  let adjustment: ReturnType<typeof inventory.request.post> | undefined;
  try {
    connection.stdin.write(`begin; set local application_name='${sessionName}'; set local statement_timeout='15s'; select set_config('request.jwt.claim.sub','${inventory.userId}',true); select pg_advisory_xact_lock(hashtextextended('${inventory.orgId}',0)); select 'boundary-acquired';\n`);
    await expect.poll(() => output, { timeout: 15_000 }).toContain("boundary-acquired");
    // A normal adjustment must wait without retaining the stock lock. The
    // receipt already owns the replenishment boundary, as a batch writer does.
    adjustment = inventory.request.post("/api/stock/movements", {
      headers: inventory.headers(), data: { material_id: material.id, location_id: location.id, quantity_delta: 3, reason: "adjustment" }
    });
    await expect.poll(() => Number(sql(`select count(*) from pg_stat_activity where pid<>pg_backend_pid() and wait_event='advisory' and query like '%create_stock_movement%'`)), { timeout: 15_000 }).toBeGreaterThan(0);
    expect(Number(sql(`select count(*) from pg_locks l join pg_stat_activity a using(pid) where a.wait_event='advisory' and a.query like '%create_stock_movement%' and l.locktype='advisory' and l.granted`))).toBe(0);
    connection.stdin.end(`select * from public.receive_purchase_order('${inventory.orgId}','${po.id}','${inventory.userId}','[{"po_line_id":"${po.lines[0].id}","location_id":"${location.id}","quantity_received":10}]'); commit;\n`);
    expect(await closed, errors).toBe(0);
    const response = await adjustment;
    expect(response.status(), await response.text()).toBe(201);
    expect((await inventory.po(po.id)).status).toBe("received");
    await inventory.balances([[material.id, location.id, 13]]);
  } finally {
    // Close the transaction even if a polling assertion failed.
    if (!connection.stdin.destroyed) connection.stdin.end("rollback;\n");
    await closed;
    await adjustment?.catch(() => undefined);
  }
});
