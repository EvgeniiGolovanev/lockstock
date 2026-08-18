begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

create function pg_temp.try_sql(statement text)
returns text
language plpgsql
as $$
begin
  execute statement;
  return 'ok';
exception when others then
  return sqlstate;
end;
$$;

insert into public.organizations (id, name)
values
  ('10000000-0000-0000-0000-000000000001', 'DB Test Active Org'),
  ('10000000-0000-0000-0000-000000000002', 'DB Test Hidden Org'),
  ('10000000-0000-0000-0000-000000000003', 'DB Test Expired Org');

insert into public.organization_billing (org_id, plan, status, billing_interval, trial_ends_at)
values
  ('10000000-0000-0000-0000-000000000001', 'starter', 'active', 'monthly', null),
  ('10000000-0000-0000-0000-000000000002', 'starter', 'active', 'monthly', null),
  ('10000000-0000-0000-0000-000000000003', 'starter', 'active', 'monthly', null);

insert into public.org_users (org_id, user_id, role)
values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'manager'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'viewer'),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'manager');

insert into public.locations (id, org_id, code, name)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'ACTIVE', 'Active location');

insert into public.materials (id, org_id, sku, name)
values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'ACTIVE-SKU', 'Active material');

update public.organization_billing
set status = 'trialing', trial_ends_at = now() - interval '1 day'
where org_id = '10000000-0000-0000-0000-000000000003';

insert into public.org_invitations (
  id, org_id, org_name, email, role, invited_by, token_hash, status, expires_at
)
values (
  '50000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'DB Test Active Org',
  'invitee@example.test',
  'member',
  '20000000-0000-0000-0000-000000000001',
  'p0-01-invitation-token',
  'pending',
  now() + interval '1 day'
);

select has_function(
  'public',
  'workspace_has_write_access',
  array['uuid'],
  'database exposes one reusable workspace write-access predicate'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.create_stock_movement(uuid,uuid,uuid,numeric,movement_reason,text,text,uuid,uuid)'::regprocedure,
    'execute'
  ),
  'anonymous callers cannot execute create_stock_movement'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.create_stock_transfer(uuid,uuid,uuid,uuid,numeric,text,uuid)'::regprocedure,
    'execute'
  ),
  'anonymous callers cannot execute create_stock_transfer'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.receive_purchase_order(uuid,uuid,uuid,jsonb)'::regprocedure,
    'execute'
  ),
  'anonymous callers cannot execute receive_purchase_order'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.transition_purchase_order_status(uuid,uuid,public.po_status)'::regprocedure,
    'execute'
  ),
  'anonymous callers cannot execute transition_purchase_order_status'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","email":"manager@example.test","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.organizations where id = '10000000-0000-0000-0000-000000000001'),
  1::bigint,
  'RLS allows an organization member to read their organization'
);

select is(
  (select count(*) from public.organizations where id = '10000000-0000-0000-0000-000000000002'),
  0::bigint,
  'RLS denies a non-member access to another organization'
);

select lives_ok(
  $$update public.materials
    set name = 'Authorized update'
    where id = '40000000-0000-0000-0000-000000000001'$$,
  'an active manager can update a domain table directly'
);

select is(
  (select name from public.materials where id = '40000000-0000-0000-0000-000000000001'),
  'Authorized update',
  'the authorized direct update persists'
);

select throws_ok(
  $$select public.create_stock_movement(
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    1,
    'adjustment',
    null,
    null,
    null,
    '29999999-9999-4999-8999-999999999999'
  )$$,
  '42501',
  'Actor id must match authenticated user',
  'mutation RPC rejects actor spoofing'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","email":"viewer@example.test","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.create_stock_movement(
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    1,
    'adjustment',
    null,
    null,
    null,
    '20000000-0000-0000-0000-000000000002'
  )$$,
  '42501',
  'This action requires member role or higher',
  'viewer cannot bypass the member role through a mutation RPC'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","email":"invitee@example.test","role":"authenticated"}',
  true
);

select is(
  pg_temp.try_sql($$update public.org_invitations
    set org_id = '10000000-0000-0000-0000-000000000002', role = 'owner'
    where id = '50000000-0000-0000-0000-000000000001'$$),
  'ok',
  'invitee cannot redirect an invitation to another organization because RLS updates no rows'
);

reset role;

select is(
  (select org_id from public.org_invitations where id = '50000000-0000-0000-0000-000000000001'),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'invitee cannot redirect an invitation to another organization'
);

select is(
  (select role from public.org_invitations where id = '50000000-0000-0000-0000-000000000001'),
  'member'::public.org_role,
  'invitee cannot elevate an invitation role'
);

insert into public.workspace_trial_redemptions (user_id, org_id)
values ('20000000-0000-0000-0000-000000000099', '10000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000099","email":"replay@example.test","role":"authenticated"}',
  true
);
select is(
  pg_temp.try_sql($$select public.create_organization_with_owner('Replay Org', 'starter'::public.billing_plan, true)$$),
  '42501',
  'trial replay is blocked after the workspace trial has already been redeemed'
);

reset role;

select * from finish();

rollback;
