begin;

create extension if not exists pgtap with schema extensions;

select plan(44);

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

select set_eq(
  $$
    select c.relname::text
    from pg_trigger trigger
    join pg_class c on c.oid = trigger.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and trigger.tgname = 'trg_workspace_write_guard'
      and not trigger.tgisinternal
  $$,
  $$
    values
      ('organizations'::text), ('org_users'::text), ('teams'::text), ('team_members'::text),
      ('locations'::text), ('materials'::text), ('suppliers'::text), ('supplier_materials'::text),
      ('inventory_balances'::text), ('stock_movements'::text), ('purchase_orders'::text),
      ('po_lines'::text), ('org_invitations'::text)
  $$,
  'every tenant mutation surface has a workspace write guard'
);

select set_eq(
  $$
    select c.relname::text
    from pg_trigger trigger
    join pg_class c on c.oid = trigger.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and trigger.tgname = 'trg_workspace_actor'
      and not trigger.tgisinternal
  $$,
  $$
    values
      ('teams'::text), ('team_members'::text), ('materials'::text), ('suppliers'::text),
      ('purchase_orders'::text), ('stock_movements'::text), ('org_invitations'::text)
  $$,
  'all caller-controlled actor columns are derived or immutable'
);

insert into public.organizations (id, name)
values
  ('63000000-0000-0000-0000-000000000001', 'Active mutation org'),
  ('63000000-0000-0000-0000-000000000002', 'Expired mutation org'),
  ('63000000-0000-0000-0000-000000000003', 'Hidden mutation org'),
  ('63000000-0000-0000-0000-000000000004', 'Trial mutation org'),
  ('63000000-0000-0000-0000-000000000005', 'Grace mutation org'),
  ('63000000-0000-0000-0000-000000000006', 'Missing billing mutation org');

insert into public.organization_billing (org_id, plan, status, billing_interval)
values
  ('63000000-0000-0000-0000-000000000001', 'business', 'active', 'monthly'),
  ('63000000-0000-0000-0000-000000000002', 'business', 'active', 'monthly'),
  ('63000000-0000-0000-0000-000000000003', 'business', 'active', 'monthly'),
  ('63000000-0000-0000-0000-000000000004', 'business', 'active', 'monthly'),
  ('63000000-0000-0000-0000-000000000005', 'business', 'active', 'monthly'),
  ('63000000-0000-0000-0000-000000000006', 'business', 'active', 'monthly');

insert into public.org_users (org_id, user_id, role)
values
  ('63000000-0000-0000-0000-000000000001', '64000000-0000-0000-0000-000000000001', 'owner'),
  ('63000000-0000-0000-0000-000000000001', '64000000-0000-0000-0000-000000000002', 'viewer'),
  ('63000000-0000-0000-0000-000000000001', '64000000-0000-0000-0000-000000000003', 'member'),
  ('63000000-0000-0000-0000-000000000001', '64000000-0000-0000-0000-000000000004', 'manager'),
  ('63000000-0000-0000-0000-000000000003', '64000000-0000-0000-0000-000000000004', 'manager'),
  ('63000000-0000-0000-0000-000000000002', '64000000-0000-0000-0000-000000000001', 'owner'),
  ('63000000-0000-0000-0000-000000000004', '64000000-0000-0000-0000-000000000001', 'owner'),
  ('63000000-0000-0000-0000-000000000005', '64000000-0000-0000-0000-000000000001', 'owner'),
  ('63000000-0000-0000-0000-000000000006', '64000000-0000-0000-0000-000000000001', 'owner');

insert into public.teams (id, org_id, name, is_default)
values
  ('65000000-0000-0000-0000-000000000001', '63000000-0000-0000-0000-000000000001', 'Active team', true),
  ('65000000-0000-0000-0000-000000000002', '63000000-0000-0000-0000-000000000002', 'Expired team', true);
insert into public.team_members (team_id, user_id)
values ('65000000-0000-0000-0000-000000000002', '64000000-0000-0000-0000-000000000001');

insert into public.locations (id, org_id, code, name)
values
  ('66000000-0000-0000-0000-000000000001', '63000000-0000-0000-0000-000000000001', 'ACTIVE', 'Active location'),
  ('66000000-0000-0000-0000-000000000002', '63000000-0000-0000-0000-000000000002', 'EXPIRED', 'Expired location');

insert into public.materials (id, org_id, sku, name)
values
  ('67000000-0000-0000-0000-000000000001', '63000000-0000-0000-0000-000000000001', 'ACTIVE', 'Active material'),
  ('67000000-0000-0000-0000-000000000002', '63000000-0000-0000-0000-000000000002', 'EXPIRED', 'Expired material'),
  ('67000000-0000-0000-0000-000000000004', '63000000-0000-0000-0000-000000000004', 'TRIAL', 'Trial material'),
  ('67000000-0000-0000-0000-000000000005', '63000000-0000-0000-0000-000000000005', 'GRACE', 'Grace material'),
  ('67000000-0000-0000-0000-000000000006', '63000000-0000-0000-0000-000000000006', 'MISSING', 'Missing billing material');

update public.materials
set created_by = '64000000-0000-0000-0000-000000000001'
where id = '67000000-0000-0000-0000-000000000001';

insert into public.suppliers (id, org_id, name)
values
  ('68000000-0000-0000-0000-000000000001', '63000000-0000-0000-0000-000000000002', 'Expired supplier parent'),
  ('68000000-0000-0000-0000-000000000002', '63000000-0000-0000-0000-000000000002', 'Expired supplier delete target');
insert into public.supplier_materials (id, org_id, supplier_id, material_id)
values (
  '69000000-0000-0000-0000-000000000001',
  '63000000-0000-0000-0000-000000000002',
  '68000000-0000-0000-0000-000000000001',
  '67000000-0000-0000-0000-000000000002'
);
insert into public.inventory_balances (id, org_id, material_id, location_id, quantity)
values (
  '70000000-0000-0000-0000-000000000001',
  '63000000-0000-0000-0000-000000000002',
  '67000000-0000-0000-0000-000000000002',
  '66000000-0000-0000-0000-000000000002',
  1
);
insert into public.stock_movements (id, org_id, material_id, location_id, quantity_delta, reason)
values (
  '71000000-0000-0000-0000-000000000001',
  '63000000-0000-0000-0000-000000000002',
  '67000000-0000-0000-0000-000000000002',
  '66000000-0000-0000-0000-000000000002',
  1,
  'adjustment'
);
insert into public.purchase_orders (id, org_id, supplier_id, po_number)
values (
  '72000000-0000-0000-0000-000000000001',
  '63000000-0000-0000-0000-000000000002',
  '68000000-0000-0000-0000-000000000001',
  'PO-EXPIRED'
);
insert into public.po_lines (id, org_id, purchase_order_id, material_id, quantity_ordered)
values (
  '73000000-0000-0000-0000-000000000001',
  '63000000-0000-0000-0000-000000000002',
  '72000000-0000-0000-0000-000000000001',
  '67000000-0000-0000-0000-000000000002',
  2
);
insert into public.org_invitations (
  id, org_id, org_name, email, role, invited_by, token_hash, status, expires_at
)
values (
  '74000000-0000-0000-0000-000000000001',
  '63000000-0000-0000-0000-000000000002',
  'Expired mutation org',
  'expired-invitee@example.test',
  'member',
  '64000000-0000-0000-0000-000000000001',
  'expired-mutation-token',
  'pending',
  now() + interval '1 day'
), (
  '74000000-0000-0000-0000-000000000002',
  '63000000-0000-0000-0000-000000000001',
  'Active mutation org',
  'active-invitee@example.test',
  'member',
  '64000000-0000-0000-0000-000000000001',
  'active-mutation-token',
  'pending',
  now() + interval '1 day'
);

update public.organization_billing
set status = 'trialing', trial_ends_at = now() - interval '1 day'
where org_id = '63000000-0000-0000-0000-000000000002';
update public.organization_billing
set status = 'trialing', trial_ends_at = now() + interval '1 day'
where org_id = '63000000-0000-0000-0000-000000000004';
update public.organization_billing
set status = 'past_due', past_due_since = now() - interval '6 days'
where org_id = '63000000-0000-0000-0000-000000000005';
delete from public.organization_billing where org_id = '63000000-0000-0000-0000-000000000006';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"64000000-0000-0000-0000-000000000004","email":"manager@example.test","role":"authenticated"}',
  true
);

select is(
  pg_temp.try_sql($$insert into public.materials (id, org_id, sku, name)
    values ('67000000-0000-0000-0000-000000000010', '63000000-0000-0000-0000-000000000001', 'MANAGER', 'Manager material')$$),
  'ok',
  'active manager can insert a domain row directly'
);
select is(
  (select created_by from public.materials where id = '67000000-0000-0000-0000-000000000010'),
  '64000000-0000-0000-0000-000000000004'::uuid,
  'direct insert derives created_by from auth.uid'
);
select is(
  pg_temp.try_sql($$update public.materials set name = 'Manager updated'
    where id = '67000000-0000-0000-0000-000000000010'$$),
  'ok',
  'active manager can update a domain row directly'
);
select is(
  pg_temp.try_sql($$update public.materials
    set created_by = '64000000-0000-0000-0000-000000000004'
    where id = '67000000-0000-0000-0000-000000000001'$$),
  'ok',
  'updating an existing row preserves its original actor instead of breaking upsert'
);
select is(
  (select created_by from public.materials where id = '67000000-0000-0000-0000-000000000001'),
  '64000000-0000-0000-0000-000000000001'::uuid,
  'an update cannot replace the original actor'
);
select is(
  pg_temp.try_sql($$delete from public.materials
    where id = '67000000-0000-0000-0000-000000000010'$$),
  'ok',
  'active manager can delete a domain row directly'
);
insert into public.suppliers (id, org_id, name)
values ('68000000-0000-0000-0000-000000000010', '63000000-0000-0000-0000-000000000001', 'Active supplier');
select is(
  pg_temp.try_sql($$insert into public.purchase_orders (
      id, org_id, supplier_id, po_number, status, sent_at
    ) values (
      '72000000-0000-0000-0000-000000000010',
      '63000000-0000-0000-0000-000000000001',
      '68000000-0000-0000-0000-000000000010',
      'PO-FORGED',
      'sent',
      now()
    )$$),
  '42501',
  'purchase order workflow fields cannot be forged on insert'
);
insert into public.purchase_orders (id, org_id, supplier_id, po_number, status)
values ('72000000-0000-0000-0000-000000000010', '63000000-0000-0000-0000-000000000001', '68000000-0000-0000-0000-000000000010', 'PO-DIRECT', 'draft');
insert into public.po_lines (id, org_id, purchase_order_id, material_id, quantity_ordered)
values ('73000000-0000-0000-0000-000000000010', '63000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000010', '67000000-0000-0000-0000-000000000001', 2);
select is(
  pg_temp.try_sql($$update public.purchase_orders
    set status = 'sent', sent_at = now()
    where id = '72000000-0000-0000-0000-000000000010'$$),
  '42501',
  'purchase order workflow fields cannot be updated directly'
);
select is(
  pg_temp.try_sql($$insert into public.po_lines (
      id, org_id, purchase_order_id, material_id, quantity_ordered, quantity_received
    ) values (
      '73000000-0000-0000-0000-000000000011',
      '63000000-0000-0000-0000-000000000001',
      '72000000-0000-0000-0000-000000000010',
      '67000000-0000-0000-0000-000000000001',
      2,
      1
    )$$),
  '42501',
  'po_line receipt quantity cannot be forged on insert'
);
select is(
  pg_temp.try_sql($$update public.po_lines
    set quantity_received = 1
    where id = '73000000-0000-0000-0000-000000000010'$$),
  '42501',
  'po_line receipt quantity cannot be updated directly'
);
select is(
  pg_temp.try_sql($$insert into public.materials (id, org_id, sku, name, created_by)
    values (
      '67000000-0000-0000-0000-000000000011',
      '63000000-0000-0000-0000-000000000001',
      'SPOOF',
      'Spoofed actor',
      '64000000-0000-0000-0000-000000000099'
    )$$),
  '42501',
  'direct insert rejects created_by spoofing'
);
select is(
  pg_temp.try_sql($$update public.materials
    set org_id = '63000000-0000-0000-0000-000000000003'
    where id = '67000000-0000-0000-0000-000000000001'$$),
  '42501',
  'tenant-key reassignment cannot bypass target-organization limits'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"64000000-0000-0000-0000-000000000003","email":"member@example.test","role":"authenticated"}',
  true
);
select is(
  pg_temp.try_sql($$insert into public.materials (org_id, sku, name)
    values ('63000000-0000-0000-0000-000000000001', 'MEMBER', 'Member material')$$),
  '42501',
  'active member cannot perform a manager table mutation'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"64000000-0000-0000-0000-000000000002","email":"viewer@example.test","role":"authenticated"}',
  true
);
select is(
  pg_temp.try_sql($$update public.materials set name = 'Viewer update'
    where id = '67000000-0000-0000-0000-000000000001'$$),
  'ok',
  'viewer update is safely filtered by RLS'
);
select is(
  (select name from public.materials where id = '67000000-0000-0000-0000-000000000001'),
  'Active material',
  'viewer cannot change the protected row'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"64000000-0000-0000-0000-000000000099","email":"outsider@example.test","role":"authenticated"}',
  true
);
select is(
  pg_temp.try_sql($$insert into public.materials (org_id, sku, name)
    values ('63000000-0000-0000-0000-000000000001', 'OUTSIDER', 'Outsider material')$$),
  '42501',
  'authenticated non-member cannot insert into another tenant'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"64000000-0000-0000-0000-000000000001","email":"owner@example.test","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.materials where id = '67000000-0000-0000-0000-000000000002'),
  1::bigint,
  'expired workspace data remains readable'
);
select is(pg_temp.try_sql($$update public.organizations set name = 'Blocked' where id = '63000000-0000-0000-0000-000000000002'$$), '42501', 'expired organization update is blocked');
select is(pg_temp.try_sql($$update public.org_users set role = 'manager' where org_id = '63000000-0000-0000-0000-000000000002' and user_id = '64000000-0000-0000-0000-000000000001'$$), '42501', 'expired org_users update is blocked');
select is(pg_temp.try_sql($$update public.teams set name = 'Blocked' where id = '65000000-0000-0000-0000-000000000002'$$), '42501', 'expired teams update is blocked');
select is(pg_temp.try_sql($$delete from public.team_members where team_id = '65000000-0000-0000-0000-000000000002' and user_id = '64000000-0000-0000-0000-000000000001'$$), '42501', 'expired team_members delete is blocked');
select is(pg_temp.try_sql($$insert into public.locations (org_id, code, name) values ('63000000-0000-0000-0000-000000000002', 'BLOCKED', 'Blocked')$$), '42501', 'expired locations insert is blocked');
select is(pg_temp.try_sql($$update public.materials set name = 'Blocked' where id = '67000000-0000-0000-0000-000000000002'$$), '42501', 'expired materials update is blocked');
select is(pg_temp.try_sql($$delete from public.suppliers where id = '68000000-0000-0000-0000-000000000002'$$), '42501', 'expired suppliers delete is blocked');
select is(pg_temp.try_sql($$update public.supplier_materials set preferred = true where id = '69000000-0000-0000-0000-000000000001'$$), '42501', 'expired supplier_materials update is blocked');
select is(pg_temp.try_sql($$update public.purchase_orders set notes = 'Blocked' where id = '72000000-0000-0000-0000-000000000001'$$), '42501', 'expired purchase_orders update is blocked');
select is(pg_temp.try_sql($$update public.po_lines set quantity_ordered = 3 where id = '73000000-0000-0000-0000-000000000001'$$), '42501', 'expired po_lines update is blocked');
select is(pg_temp.try_sql($$delete from public.org_invitations where id = '74000000-0000-0000-0000-000000000001'$$), '42501', 'expired org_invitations delete is blocked');

select ok(
  not has_table_privilege('authenticated', 'public.inventory_balances', 'insert')
    and not has_table_privilege('authenticated', 'public.inventory_balances', 'update')
    and not has_table_privilege('authenticated', 'public.inventory_balances', 'delete'),
  'inventory_balances remains RPC-only for authenticated callers'
);
select ok(
  not has_table_privilege('authenticated', 'public.stock_movements', 'insert')
    and not has_table_privilege('authenticated', 'public.stock_movements', 'update')
    and not has_table_privilege('authenticated', 'public.stock_movements', 'delete'),
  'stock_movements remains RPC-only for authenticated callers'
);

select is(pg_temp.try_sql($$update public.materials set name = 'Trial write' where id = '67000000-0000-0000-0000-000000000004'$$), 'ok', 'valid trial retains direct writes');
select is(pg_temp.try_sql($$update public.materials set name = 'Grace write' where id = '67000000-0000-0000-0000-000000000005'$$), 'ok', 'valid payment grace retains direct writes');
select is(pg_temp.try_sql($$update public.materials set name = 'Missing write' where id = '67000000-0000-0000-0000-000000000006'$$), '42501', 'missing billing blocks direct writes');

select is(
  pg_temp.try_sql($$insert into public.org_invitations (
      org_id, org_name, email, role, invited_by, token_hash, status, expires_at
    ) values (
      '63000000-0000-0000-0000-000000000001',
      'Active mutation org',
      'owner-invite@example.test',
      'owner',
      '64000000-0000-0000-0000-000000000001',
      'owner-invite-token',
      'pending',
      now() + interval '1 day'
    )$$),
  '23514',
  'owner-role invitations cannot be created through the direct table surface'
);
select is(
  pg_temp.try_sql($$update public.org_invitations
    set status = 'accepted',
        accepted_by = '64000000-0000-0000-0000-000000000099',
        accepted_at = now()
    where id = '74000000-0000-0000-0000-000000000002'$$),
  '42501',
  'an owner cannot forge invitation acceptance fields through direct update'
);
select is(
  pg_temp.try_sql($$update public.org_invitations
    set status = 'superseded'
    where id = '74000000-0000-0000-0000-000000000002'$$),
  'ok',
  'an owner can still supersede a pending invitation'
);
select is(
  pg_temp.try_sql($$insert into public.org_invitations (
      org_id, org_name, email, role, invited_by, token_hash, status,
      accepted_at, accepted_by, expires_at
    ) values (
      '63000000-0000-0000-0000-000000000001',
      'Active mutation org',
      'forged-accepted@example.test',
      'member',
      '64000000-0000-0000-0000-000000000001',
      'forged-accepted-token',
      'accepted',
      now(),
      '64000000-0000-0000-0000-000000000099',
      now() + interval '1 day'
    )$$),
  '42501',
  'an owner cannot insert an invitation that is already accepted'
);

select set_config('lockstock.bootstrap_org_id', '63000000-0000-0000-0000-000000000002', true);
select is(
  pg_temp.try_sql($$insert into public.teams (org_id, name)
    values ('63000000-0000-0000-0000-000000000002', 'Forged bootstrap team')$$),
  '42501',
  'an authenticated caller cannot bypass read-only state with a custom bootstrap setting'
);

select ok(
  not has_table_privilege('authenticated', 'public.organizations', 'delete'),
  'authenticated callers cannot delete an organization to mint another trial'
);
select is(
  pg_temp.try_sql($$delete from public.org_users
    where org_id = '63000000-0000-0000-0000-000000000001'
      and user_id = '64000000-0000-0000-0000-000000000001'$$),
  '42501',
  'an owner cannot delete their own membership to mint another trial'
);
select is(
  pg_temp.try_sql($$update public.org_users set role = 'viewer'
    where org_id = '63000000-0000-0000-0000-000000000004'
      and user_id = '64000000-0000-0000-0000-000000000001'$$),
  '42501',
  'an owner cannot demote their own membership'
);
select is(
  pg_temp.try_sql($$update public.org_users
    set user_id = '64000000-0000-0000-0000-000000000098'
    where org_id = '63000000-0000-0000-0000-000000000001'
      and user_id = '64000000-0000-0000-0000-000000000002'$$),
  '42501',
  'membership identity is immutable'
);

reset role;

select * from finish();

rollback;
