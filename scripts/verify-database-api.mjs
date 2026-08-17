import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signJwt(secret, claims) {
  const header = base64Url({ alg: "HS256", typ: "JWT" });
  const payload = base64Url(claims);
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

async function request(restUrl, apiKey, token, path, options = {}) {
  const response = await fetch(`${restUrl}${path}`, {
    ...options,
    headers: {
      apikey: apiKey,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...options.headers
    }
  });
  const body = await response.text();
  return { body, response };
}

function sql(projectId, statement) {
  const result = spawnSync(
    process.platform === "win32" ? "docker.exe" : "docker",
    ["exec", "-i", `supabase_db_${projectId}`, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
    { encoding: "utf8", input: `\\set VERBOSITY verbose\n${statement}`, maxBuffer: 16 * 1024 * 1024 }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Database fixture query failed:\n${result.stdout}\n${result.stderr}`);
  }
}

function concurrentSql(projectId, statements) {
  return statements.map((statement) =>
    new Promise((resolve) => {
      const child = spawn(
        process.platform === "win32" ? "docker.exe" : "docker",
        ["exec", "-i", `supabase_db_${projectId}`, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
        { windowsHide: true }
      );
      let output = "";
      child.stdout.on("data", (chunk) => (output += chunk));
      child.stderr.on("data", (chunk) => (output += chunk));
      child.on("close", (code) => resolve({ code, output }));
      child.stdin.end(`\\set VERBOSITY verbose\n${statement}`);
    })
  );
}

const [, , projectId, statusJson] = process.argv;
if (!projectId || !statusJson) {
  throw new Error("Expected disposable project id and Supabase status JSON.");
}

const status = JSON.parse(statusJson);
const restUrl = status.REST_URL;
const apiKey = status.ANON_KEY;
const jwtSecret = status.JWT_SECRET;
const now = Math.floor(Date.now() / 1000);
const managerId = "90000000-0000-4000-8000-000000000001";
const viewerId = "90000000-0000-4000-8000-000000000002";
const outsiderId = "90000000-0000-4000-8000-000000000003";
const bootstrapId = "90000000-0000-4000-8000-000000000004";
const activeOrg = "91000000-0000-4000-8000-000000000001";
const expiredOrg = "91000000-0000-4000-8000-000000000002";
const materialId = "92000000-0000-4000-8000-000000000001";
const locationId = "93000000-0000-4000-8000-000000000001";

const raceSurfaces = [
  {
    name: "org_users",
    org: "94000000-0000-4000-8000-000000000001",
    setup: `insert into public.org_users (org_id, user_id, role) values
      ('94000000-0000-4000-8000-000000000001','${managerId}','owner'),
      ('94000000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000002','member');`,
    a: `insert into public.org_users (org_id,user_id,role) values ('94000000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000003','member')`,
    b: `insert into public.org_users (org_id,user_id,role) values ('94000000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000004','member')`,
    count: "select count(*) from public.org_users where org_id='94000000-0000-4000-8000-000000000001'",
    limit: 3
  },
  {
    name: "teams",
    org: "94000000-0000-4000-8000-000000000002",
    setup: "",
    a: `insert into public.teams (org_id,name) values ('94000000-0000-4000-8000-000000000002','Race A')`,
    b: `insert into public.teams (org_id,name) values ('94000000-0000-4000-8000-000000000002','Race B')`,
    count: "select count(*) from public.teams where org_id='94000000-0000-4000-8000-000000000002'",
    limit: 1
  },
  {
    name: "locations",
    org: "94000000-0000-4000-8000-000000000003",
    setup: `insert into public.locations (org_id,code,name) values
      ('94000000-0000-4000-8000-000000000003','BASE-1','Base 1'),
      ('94000000-0000-4000-8000-000000000003','BASE-2','Base 2');`,
    a: `insert into public.locations (org_id,code,name) values ('94000000-0000-4000-8000-000000000003','RACE-A','Race A')`,
    b: `insert into public.locations (org_id,code,name) values ('94000000-0000-4000-8000-000000000003','RACE-B','Race B')`,
    count: "select count(*) from public.locations where org_id='94000000-0000-4000-8000-000000000003'",
    limit: 3
  },
  {
    name: "materials",
    org: "94000000-0000-4000-8000-000000000004",
    setup: `insert into public.materials (org_id,sku,name)
      select '94000000-0000-4000-8000-000000000004','BASE-'||g,'Base '||g from generate_series(1,499) g;`,
    a: `insert into public.materials (org_id,sku,name) values ('94000000-0000-4000-8000-000000000004','RACE-A','Race A')`,
    b: `insert into public.materials (org_id,sku,name) values ('94000000-0000-4000-8000-000000000004','RACE-B','Race B')`,
    count: "select count(*) from public.materials where org_id='94000000-0000-4000-8000-000000000004'",
    limit: 500
  },
  {
    name: "suppliers",
    org: "94000000-0000-4000-8000-000000000005",
    setup: `insert into public.suppliers (org_id,name)
      select '94000000-0000-4000-8000-000000000005','Base '||g from generate_series(1,49) g;`,
    a: `insert into public.suppliers (org_id,name) values ('94000000-0000-4000-8000-000000000005','Race A')`,
    b: `insert into public.suppliers (org_id,name) values ('94000000-0000-4000-8000-000000000005','Race B')`,
    count: "select count(*) from public.suppliers where org_id='94000000-0000-4000-8000-000000000005'",
    limit: 50
  },
  {
    name: "purchase_orders",
    org: "94000000-0000-4000-8000-000000000006",
    setup: `insert into public.suppliers (id,org_id,name) values ('94600000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000006','PO supplier');
      insert into public.purchase_orders (org_id,supplier_id,po_number)
      select '94000000-0000-4000-8000-000000000006','94600000-0000-4000-8000-000000000001','BASE-'||g from generate_series(1,49) g;`,
    a: `insert into public.purchase_orders (org_id,supplier_id,po_number) values ('94000000-0000-4000-8000-000000000006','94600000-0000-4000-8000-000000000001','RACE-A')`,
    b: `insert into public.purchase_orders (org_id,supplier_id,po_number) values ('94000000-0000-4000-8000-000000000006','94600000-0000-4000-8000-000000000001','RACE-B')`,
    count: "select count(*) from public.purchase_orders where org_id='94000000-0000-4000-8000-000000000006' and created_at >= (date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')",
    limit: 50
  },
  {
    name: "stock_movements",
    org: "94000000-0000-4000-8000-000000000007",
    setup: `insert into public.locations (id,org_id,code,name) values
        ('94700000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000007','STOCK-A','Stock A'),
        ('94700000-0000-4000-8000-000000000003','94000000-0000-4000-8000-000000000007','STOCK-B','Stock B');
      insert into public.materials (id,org_id,sku,name) values
        ('94700000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000007','STOCK-A','Stock A'),
        ('94700000-0000-4000-8000-000000000004','94000000-0000-4000-8000-000000000007','STOCK-B','Stock B');
      insert into public.inventory_balances (org_id,material_id,location_id,quantity) values
        ('94000000-0000-4000-8000-000000000007','94700000-0000-4000-8000-000000000002','94700000-0000-4000-8000-000000000001',0),
        ('94000000-0000-4000-8000-000000000007','94700000-0000-4000-8000-000000000004','94700000-0000-4000-8000-000000000003',0);
      insert into public.stock_movements (org_id,material_id,location_id,quantity_delta,reason)
      select '94000000-0000-4000-8000-000000000007','94700000-0000-4000-8000-000000000002','94700000-0000-4000-8000-000000000001',1,'adjustment' from generate_series(1,499);`,
    a: `select public.create_stock_movement('94000000-0000-4000-8000-000000000007','94700000-0000-4000-8000-000000000002','94700000-0000-4000-8000-000000000001',1,'adjustment',null,null,null,'${managerId}')`,
    b: `select public.create_stock_movement('94000000-0000-4000-8000-000000000007','94700000-0000-4000-8000-000000000004','94700000-0000-4000-8000-000000000003',1,'adjustment',null,null,null,'${managerId}')`,
    count: "select count(*) from public.stock_movements where org_id='94000000-0000-4000-8000-000000000007' and created_at >= (date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')",
    limit: 500
  }
];

const tokenFor = (sub, email) =>
  signJwt(jwtSecret, {
    aud: "authenticated",
    email,
    exp: now + 3600,
    iat: now,
    iss: "supabase-demo",
    role: "authenticated",
    sub
  });

const managerToken = tokenFor(managerId, "manager-data-api@example.test");
const viewerToken = tokenFor(viewerId, "viewer-data-api@example.test");
const outsiderToken = tokenFor(outsiderId, "outsider-data-api@example.test");
const bootstrapToken = tokenFor(bootstrapId, "bootstrap-data-api@example.test");

sql(
  projectId,
  `
    insert into public.organizations (id, name) values
      ('${activeOrg}', 'Data API active'),
      ('${expiredOrg}', 'Data API expired');
    insert into public.organization_billing (org_id, plan, status, billing_interval) values
      ('${activeOrg}', 'starter', 'active', 'monthly'),
      ('${expiredOrg}', 'starter', 'active', 'monthly');
    insert into public.org_users (org_id, user_id, role) values
      ('${activeOrg}', '${managerId}', 'manager'),
      ('${activeOrg}', '${viewerId}', 'viewer'),
      ('${expiredOrg}', '${managerId}', 'manager');
    insert into public.locations (id, org_id, code, name)
      values ('${locationId}', '${activeOrg}', 'API', 'Data API location');
    insert into public.materials (id, org_id, sku, name)
      values ('${materialId}', '${activeOrg}', 'API-BASE', 'Data API material');
    update public.organization_billing
      set status = 'trialing', trial_ends_at = now() - interval '1 day'
      where org_id = '${expiredOrg}';
  `
);

const directInsert = await request(restUrl, apiKey, managerToken, "/materials", {
  method: "POST",
  headers: { prefer: "return=representation" },
  body: JSON.stringify({
    id: "92000000-0000-4000-8000-000000000002",
    org_id: activeOrg,
    sku: "API-DIRECT",
    name: "Data API direct"
  })
});
assert.equal(directInsert.response.status, 201, directInsert.body);
assert.equal(JSON.parse(directInsert.body)[0].created_by, managerId);

const directUpdate = await request(
  restUrl,
  apiKey,
  managerToken,
  `/materials?id=eq.92000000-0000-4000-8000-000000000002`,
  { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify({ name: "Manager updated" }) }
);
assert.equal(directUpdate.response.status, 200, directUpdate.body);
assert.equal(JSON.parse(directUpdate.body)[0].name, "Manager updated");

const viewerUpdate = await request(
  restUrl,
  apiKey,
  viewerToken,
  `/materials?id=eq.92000000-0000-4000-8000-000000000002`,
  { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify({ name: "Viewer wrote" }) }
);
assert.equal(viewerUpdate.response.status, 200, viewerUpdate.body);
assert.deepEqual(JSON.parse(viewerUpdate.body), []);

const outsiderInsert = await request(restUrl, apiKey, outsiderToken, "/materials", {
  method: "POST",
  body: JSON.stringify({ org_id: activeOrg, sku: "API-OUTSIDER", name: "Outsider" })
});
assert.equal(outsiderInsert.response.status, 403, outsiderInsert.body);

const anonInsert = await request(restUrl, apiKey, apiKey, "/materials", {
  method: "POST",
  body: JSON.stringify({ org_id: activeOrg, sku: "API-ANON", name: "Anonymous" })
});
assert.ok([401, 403].includes(anonInsert.response.status), anonInsert.body);

const directDelete = await request(
  restUrl,
  apiKey,
  managerToken,
  `/materials?id=eq.92000000-0000-4000-8000-000000000002`,
  { method: "DELETE", headers: { prefer: "return=representation" } }
);
assert.equal(directDelete.response.status, 200, directDelete.body);
assert.equal(JSON.parse(directDelete.body)[0].id, "92000000-0000-4000-8000-000000000002");

const expiredInsert = await request(restUrl, apiKey, managerToken, "/materials", {
  method: "POST",
  body: JSON.stringify({ org_id: expiredOrg, sku: "API-BLOCKED", name: "Blocked" })
});
assert.equal(expiredInsert.response.status, 403, expiredInsert.body);
assert.match(expiredInsert.body, /read-only/);

const movement = await request(restUrl, apiKey, managerToken, "/rpc/create_stock_movement", {
  method: "POST",
  body: JSON.stringify({
    p_org_id: activeOrg,
    p_material_id: materialId,
    p_location_id: locationId,
    p_quantity_delta: 1,
    p_reason: "adjustment",
    p_note: "Data API RPC",
    p_reference_type: null,
    p_reference_id: null,
    p_created_by: managerId
  })
});
assert.equal(movement.response.status, 200, movement.body);

const viewerMovement = await request(restUrl, apiKey, viewerToken, "/rpc/create_stock_movement", {
  method: "POST",
  body: JSON.stringify({
    p_org_id: activeOrg,
    p_material_id: materialId,
    p_location_id: locationId,
    p_quantity_delta: 1,
    p_reason: "adjustment",
    p_note: "Viewer RPC",
    p_reference_type: null,
    p_reference_id: null,
    p_created_by: viewerId
  })
});
assert.equal(viewerMovement.response.status, 403, viewerMovement.body);

// Workspace bootstrap serializes trial redemption per user. Concurrent trial
// attempts permit exactly one trial; a later non-trial workspace is independent.
sql(
  projectId,
  `create or replace function public.p001_workspace_overlap() returns trigger language plpgsql as $$
   begin if new.name like 'Concurrent workspace %' then perform pg_sleep(2); end if; return new; end $$;
   create trigger zzzz_p001_workspace_overlap before insert on public.organizations
   for each row execute function public.p001_workspace_overlap();`
);
const bootstrapRequests = await Promise.all([
  request(restUrl, apiKey, bootstrapToken, "/rpc/create_organization_with_owner", {
    method: "POST",
    body: JSON.stringify({ p_name: "Concurrent workspace A", p_plan: "starter", p_start_trial: true })
  }),
  request(restUrl, apiKey, bootstrapToken, "/rpc/create_organization_with_owner", {
    method: "POST",
    body: JSON.stringify({ p_name: "Concurrent workspace B", p_plan: "starter", p_start_trial: true })
  })
]);
const successfulTrialBootstrap = bootstrapRequests.filter((result) => result.response.status === 200);
const rejectedTrialBootstrap = bootstrapRequests.filter((result) => result.response.status === 403);
assert.equal(successfulTrialBootstrap.length, 1, bootstrapRequests.map((result) => result.body).join("\n"));
assert.equal(rejectedTrialBootstrap.length, 1, bootstrapRequests.map((result) => result.body).join("\n"));
assert.match(rejectedTrialBootstrap[0].body, /Trial already redeemed/);
const paidBootstrap = await request(restUrl, apiKey, bootstrapToken, "/rpc/create_organization_with_owner", {
  method: "POST",
  body: JSON.stringify({ p_name: "Concurrent workspace paid", p_plan: "starter", p_start_trial: false })
});
assert.equal(paidBootstrap.response.status, 200, paidBootstrap.body);
const trialOrg = JSON.parse(successfulTrialBootstrap[0].body);
const paidOrg = JSON.parse(paidBootstrap.body);
assert.notEqual(trialOrg.id, paidOrg.id);
sql(
  projectId,
  `do $$ declare v_owned integer; v_billing integer; v_default integer; v_trial integer; v_incomplete integer; begin
    select count(*) into v_owned from public.org_users where user_id='${bootstrapId}' and role='owner';
    select count(*) into v_billing from public.organization_billing b join public.org_users u on u.org_id=b.org_id where u.user_id='${bootstrapId}' and u.role='owner';
    select count(*) into v_default from public.teams t join public.org_users u on u.org_id=t.org_id where u.user_id='${bootstrapId}' and u.role='owner' and t.is_default;
    select count(*) into v_trial from public.organization_billing where org_id in ('${trialOrg.id}'::uuid, '${paidOrg.id}'::uuid) and status='trialing';
    select count(*) into v_incomplete from public.organization_billing where org_id in ('${trialOrg.id}'::uuid, '${paidOrg.id}'::uuid) and status='incomplete';
    if v_owned <> 2 or v_billing <> 2 or v_default <> 2 or v_trial <> 1 or v_incomplete <> 1 then
      raise exception 'workspace trial race left owned %, billing %, default teams %, trials %, incomplete %', v_owned, v_billing, v_default, v_trial, v_incomplete;
    end if;
  end $$;`
);

const transactionPrefix = `begin; set local role authenticated; select set_config('request.jwt.claims','{"sub":"${managerId}","email":"manager-data-api@example.test","role":"authenticated"}',true);`;
sql(
  projectId,
  `
    insert into public.organizations (id,name)
    select item.org_id, 'Race ' || item.ordinality
    from unnest(array[${raceSurfaces.map((surface) => `'${surface.org}'::uuid`).join(",")}]) with ordinality as item(org_id, ordinality);
    insert into public.organization_billing (org_id,plan,status,billing_interval)
    select item.org_id,'starter','active','monthly'
    from unnest(array[${raceSurfaces.map((surface) => `'${surface.org}'::uuid`).join(",")}]) as item(org_id);
    insert into public.org_users (org_id,user_id,role)
    select item.org_id,'${managerId}','manager'
    from unnest(array[${raceSurfaces.slice(1).map((surface) => `'${surface.org}'::uuid`).join(",")}]) as item(org_id);
    ${raceSurfaces.map((surface) => surface.setup).join("\n")}
    create or replace function public.p001_test_overlap() returns trigger language plpgsql as $$
    begin perform pg_sleep(2); return new; end $$;
    ${raceSurfaces.map((surface) => `drop trigger if exists zzzz_p001_test_overlap on public.${surface.name};
      create trigger zzzz_p001_test_overlap before insert on public.${surface.name}
      for each row execute function public.p001_test_overlap();`).join("\n")}
  `
);

for (const surface of raceSurfaces) {
  const raceResults = await Promise.all(
    concurrentSql(projectId, [
      `${transactionPrefix} ${surface.a}; commit;`,
      `${transactionPrefix} ${surface.b}; commit;`
    ])
  );
  assert.equal(raceResults.filter((result) => result.code === 0).length, 1, `${surface.name}: ${JSON.stringify(raceResults)}`);
  assert.equal(raceResults.filter((result) => result.code !== 0).length, 1, `${surface.name}: ${JSON.stringify(raceResults)}`);
  assert.match(
    raceResults.find((result) => result.code !== 0).output,
    new RegExp(`23514: starter plan limit reached for ${surface.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\(maximum ${surface.limit}\\)`),
    `${surface.name}: ${JSON.stringify(raceResults)}`
  );
  sql(
    projectId,
    `do $$ declare v_count integer; begin select (${surface.count}) into v_count;
      if v_count <> ${surface.limit} then raise exception '${surface.name} race ended at %, expected ${surface.limit}', v_count; end if; end $$;`
  );
}

console.log("Data API JWT matrix, workspace race, and all seven finite-limit races passed.");
