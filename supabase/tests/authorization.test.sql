begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

insert into public.organizations (id, name)
values
  ('10000000-0000-0000-0000-000000000001', 'DB Test Manager Org'),
  ('10000000-0000-0000-0000-000000000002', 'DB Test Hidden Org'),
  ('10000000-0000-0000-0000-000000000003', 'DB Test Viewer Org');

insert into public.organization_billing (org_id, plan, status, billing_interval)
values
  ('10000000-0000-0000-0000-000000000001', 'starter', 'active', 'monthly'),
  ('10000000-0000-0000-0000-000000000002', 'starter', 'active', 'monthly'),
  ('10000000-0000-0000-0000-000000000003', 'starter', 'active', 'monthly');

insert into public.org_users (org_id, user_id, role)
values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'manager'),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'viewer');

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);

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

select ok(
  public.is_org_role_at_least('10000000-0000-0000-0000-000000000001', 'manager'),
  'RPC allows a manager-level operation for a manager'
);

select ok(
  not public.is_org_role_at_least('10000000-0000-0000-0000-000000000003', 'manager'),
  'RPC denies a manager-level operation for a viewer'
);

select * from finish();

rollback;
