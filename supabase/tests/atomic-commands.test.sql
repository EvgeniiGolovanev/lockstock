begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

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

create function pg_temp.fail_po_line_insert()
returns trigger
language plpgsql
as $$
begin
  raise exception 'po line insert failed';
end;
$$;

create function pg_temp.fail_team_member_insert()
returns trigger
language plpgsql
as $$
begin
  raise exception 'team member insert failed';
end;
$$;

create function pg_temp.fail_org_user_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'org user delete failed';
end;
$$;

insert into public.organizations (id, name)
values ('96000000-0000-0000-0000-000000000001', 'Atomic Commands Org');
insert into public.organization_billing (org_id, plan, status, billing_interval)
values ('96000000-0000-0000-0000-000000000001', 'business', 'active', 'monthly');
insert into public.org_users (org_id, user_id, role)
values
  ('96000000-0000-0000-0000-000000000001', '97000000-0000-0000-0000-000000000001', 'owner'),
  ('96000000-0000-0000-0000-000000000001', '97000000-0000-0000-0000-000000000002', 'member');
insert into public.teams (id, org_id, name, created_by)
values ('98000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000001', 'Existing Team', '97000000-0000-0000-0000-000000000001');
insert into public.team_members (team_id, user_id, created_by)
values
  ('98000000-0000-0000-0000-000000000001', '97000000-0000-0000-0000-000000000001', '97000000-0000-0000-0000-000000000001'),
  ('98000000-0000-0000-0000-000000000001', '97000000-0000-0000-0000-000000000002', '97000000-0000-0000-0000-000000000001');
insert into public.locations (id, org_id, code, name)
values ('99000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000001', 'MAIN', 'Main Warehouse');
insert into public.materials (id, org_id, sku, name)
values ('99000000-0000-0000-0000-000000000002', '96000000-0000-0000-0000-000000000001', 'MAT-001', 'Cement');
insert into public.suppliers (id, org_id, name)
values ('99000000-0000-0000-0000-000000000003', '96000000-0000-0000-0000-000000000001', 'Vendor One');

delete from public.audit_log where org_id = '96000000-0000-0000-0000-000000000001';

create trigger trg_atomic_po_lines_fail before insert on public.po_lines
for each row execute function pg_temp.fail_po_line_insert();

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"97000000-0000-0000-0000-000000000001","email":"owner@example.test","role":"authenticated"}',
  true
);

select is(
  pg_temp.try_sql($$select public.create_purchase_order_with_lines(
    '96000000-0000-0000-0000-000000000001',
    '99000000-0000-0000-0000-000000000003',
    'PO-ATOMIC-1',
    'EUR',
    null,
    null,
    '[{"material_id":"99000000-0000-0000-0000-000000000002","quantity_ordered":3,"unit_price":12.50}]'::jsonb
  )$$),
  'P0001',
  'purchase-order creation rolls back when a line insert fails'
);
select is((select count(*) from public.purchase_orders where org_id = '96000000-0000-0000-0000-000000000001'), 0::bigint, 'failed purchase-order creation leaves no header row');
select is((select count(*) from public.po_lines where org_id = '96000000-0000-0000-0000-000000000001'), 0::bigint, 'failed purchase-order creation leaves no line rows');
reset role;
drop trigger trg_atomic_po_lines_fail on public.po_lines;
set local role authenticated;

delete from public.audit_log where org_id = '96000000-0000-0000-0000-000000000001';

select is(
  pg_temp.try_sql($$select public.create_purchase_order_with_lines(
    '96000000-0000-0000-0000-000000000001',
    '99000000-0000-0000-0000-000000000003',
    'PO-ATOMIC-1',
    'EUR',
    null,
    null,
    '[{"material_id":"99000000-0000-0000-0000-000000000002","quantity_ordered":3,"unit_price":12.50}]'::jsonb
  )$$),
  'ok',
  'purchase-order creation succeeds atomically'
);
select is((select count(*) from public.purchase_orders where org_id = '96000000-0000-0000-0000-000000000001'), 1::bigint, 'successful purchase-order creation inserts one header');
select is((select count(*) from public.po_lines where org_id = '96000000-0000-0000-0000-000000000001'), 1::bigint, 'successful purchase-order creation inserts one line');
select is((select count(*) from public.audit_log where org_id = '96000000-0000-0000-0000-000000000001' and entity_type in ('purchase_order', 'purchase_order_line')), 2::bigint, 'purchase-order creation records audit entries for the header and line');
select is(
  pg_temp.try_sql($$select public.create_purchase_order_with_lines(
    '96000000-0000-0000-0000-000000000001',
    '99000000-0000-0000-0000-000000000003',
    'PO-ATOMIC-1',
    'EUR',
    null,
    null,
    '[{"material_id":"99000000-0000-0000-0000-000000000002","quantity_ordered":3,"unit_price":12.50}]'::jsonb
  )$$),
  '23505',
  'purchase-order retries conflict cleanly on duplicate PO number'
);

delete from public.audit_log where org_id = '96000000-0000-0000-0000-000000000001';

reset role;
create trigger trg_atomic_team_members_fail before insert on public.team_members
for each row execute function pg_temp.fail_team_member_insert();

set local role authenticated;
select is(
  pg_temp.try_sql($$select public.create_team_with_owner(
    '96000000-0000-0000-0000-000000000001',
    'Field Crew',
    'Night shift'
  )$$),
  'P0001',
  'team creation rolls back when the owner membership insert fails'
);
select is((select count(*) from public.teams where org_id = '96000000-0000-0000-0000-000000000001' and name = 'Field Crew'), 0::bigint, 'failed team creation leaves no team row');
select is((select count(*) from public.team_members where team_id in (select id from public.teams where org_id = '96000000-0000-0000-0000-000000000001' and name = 'Field Crew')), 0::bigint, 'failed team creation leaves no team membership row');
reset role;
drop trigger trg_atomic_team_members_fail on public.team_members;
set local role authenticated;

select is(
  pg_temp.try_sql($$select public.create_team_with_owner(
    '96000000-0000-0000-0000-000000000001',
    'Field Crew',
    'Night shift'
  )$$),
  'ok',
  'team creation succeeds atomically'
);
select is((select count(*) from public.teams where org_id = '96000000-0000-0000-0000-000000000001' and name = 'Field Crew'), 1::bigint, 'successful team creation inserts one team');
select is((select count(*) from public.team_members tm join public.teams t on t.id = tm.team_id where t.org_id = '96000000-0000-0000-0000-000000000001' and t.name = 'Field Crew'), 1::bigint, 'successful team creation inserts the owner membership');
select is((select count(*) from public.audit_log where org_id = '96000000-0000-0000-0000-000000000001' and entity_type in ('team', 'team_member')), 2::bigint, 'team creation records audit entries for the team and owner membership');
select is(
  pg_temp.try_sql($$select public.create_team_with_owner(
    '96000000-0000-0000-0000-000000000001',
    'Field Crew',
    'Night shift'
  )$$),
  '23505',
  'team creation retries conflict cleanly on duplicate team name'
);

delete from public.audit_log where org_id = '96000000-0000-0000-0000-000000000001';

reset role;
create trigger trg_atomic_org_users_delete_fail before delete on public.org_users
for each row execute function pg_temp.fail_org_user_delete();

set local role authenticated;
select is(
  pg_temp.try_sql($$select public.remove_org_member_with_team_memberships(
    '96000000-0000-0000-0000-000000000001',
    '97000000-0000-0000-0000-000000000002'
  )$$),
  'P0001',
  'member removal rolls back when the org membership delete fails'
);
select is((select count(*) from public.org_users where org_id = '96000000-0000-0000-0000-000000000001' and user_id = '97000000-0000-0000-0000-000000000002'), 1::bigint, 'failed member removal leaves the org membership intact');
select is((select count(*) from public.team_members where user_id = '97000000-0000-0000-0000-000000000002'), 1::bigint, 'failed member removal leaves team memberships intact');
reset role;
drop trigger trg_atomic_org_users_delete_fail on public.org_users;
set local role authenticated;

select is(
  pg_temp.try_sql($$select public.remove_org_member_with_team_memberships(
    '96000000-0000-0000-0000-000000000001',
    '97000000-0000-0000-0000-000000000002'
  )$$),
  'ok',
  'member removal succeeds atomically'
);
select is((select count(*) from public.org_users where org_id = '96000000-0000-0000-0000-000000000001' and user_id = '97000000-0000-0000-0000-000000000002'), 0::bigint, 'successful member removal deletes the org membership');
select is((select count(*) from public.team_members where user_id = '97000000-0000-0000-0000-000000000002'), 0::bigint, 'successful member removal deletes team memberships');
select is((select count(*) from public.audit_log where org_id = '96000000-0000-0000-0000-000000000001' and entity_type in ('member', 'team_member')), 3::bigint, 'member removal records audit entries for the membership and team memberships');
select is(
  pg_temp.try_sql($$select public.remove_org_member_with_team_memberships(
    '96000000-0000-0000-0000-000000000001',
    '97000000-0000-0000-0000-000000000002'
  )$$),
  'P0001',
  'member removal retries fail cleanly once the access is already removed'
);

select * from finish();

rollback;
