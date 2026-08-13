begin;

create extension if not exists pgtap with schema extensions;

select plan(33);

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
  ('75000000-0000-0000-0000-000000000001', 'Active RPC org'),
  ('75000000-0000-0000-0000-000000000002', 'Expired RPC org'),
  ('75000000-0000-0000-0000-000000000003', 'Other RPC org'),
  ('75000000-0000-0000-0000-000000000004', 'Trial RPC org'),
  ('75000000-0000-0000-0000-000000000005', 'Grace RPC org'),
  ('75000000-0000-0000-0000-000000000006', 'Missing billing RPC org');
insert into public.organization_billing (org_id, plan, status, billing_interval)
values
  ('75000000-0000-0000-0000-000000000001', 'business', 'active', 'monthly'),
  ('75000000-0000-0000-0000-000000000002', 'business', 'active', 'monthly'),
  ('75000000-0000-0000-0000-000000000003', 'business', 'active', 'monthly'),
  ('75000000-0000-0000-0000-000000000004', 'business', 'active', 'monthly'),
  ('75000000-0000-0000-0000-000000000005', 'business', 'active', 'monthly'),
  ('75000000-0000-0000-0000-000000000006', 'business', 'active', 'monthly');

insert into public.org_users (org_id, user_id, role)
values
  ('75000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', 'member'),
  ('75000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000002', 'viewer'),
  ('75000000-0000-0000-0000-000000000002', '76000000-0000-0000-0000-000000000001', 'member'),
  ('75000000-0000-0000-0000-000000000004', '76000000-0000-0000-0000-000000000001', 'member'),
  ('75000000-0000-0000-0000-000000000005', '76000000-0000-0000-0000-000000000001', 'member'),
  ('75000000-0000-0000-0000-000000000006', '76000000-0000-0000-0000-000000000001', 'member');

insert into public.teams (id, org_id, name, is_default)
values
  ('77000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'Active default', true),
  ('77000000-0000-0000-0000-000000000002', '75000000-0000-0000-0000-000000000002', 'Expired default', true);

insert into public.locations (id, org_id, code, name)
values
  ('78000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'A1', 'Active from'),
  ('78000000-0000-0000-0000-000000000002', '75000000-0000-0000-0000-000000000001', 'A2', 'Active to'),
  ('78000000-0000-0000-0000-000000000003', '75000000-0000-0000-0000-000000000002', 'E1', 'Expired location'),
  ('78000000-0000-0000-0000-000000000004', '75000000-0000-0000-0000-000000000004', 'T1', 'Trial location'),
  ('78000000-0000-0000-0000-000000000005', '75000000-0000-0000-0000-000000000005', 'G1', 'Grace location'),
  ('78000000-0000-0000-0000-000000000006', '75000000-0000-0000-0000-000000000006', 'M1', 'Missing location');
insert into public.locations (id, org_id, code, name, is_active)
values ('78000000-0000-0000-0000-000000000007', '75000000-0000-0000-0000-000000000001', 'I1', 'Inactive location', false);
insert into public.materials (id, org_id, sku, name)
values
  ('79000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'ACTIVE', 'Active material'),
  ('79000000-0000-0000-0000-000000000002', '75000000-0000-0000-0000-000000000002', 'EXPIRED', 'Expired material'),
  ('79000000-0000-0000-0000-000000000004', '75000000-0000-0000-0000-000000000004', 'TRIAL', 'Trial material'),
  ('79000000-0000-0000-0000-000000000005', '75000000-0000-0000-0000-000000000005', 'GRACE', 'Grace material'),
  ('79000000-0000-0000-0000-000000000006', '75000000-0000-0000-0000-000000000006', 'MISSING', 'Missing material');
insert into public.materials (id, org_id, sku, name, is_active)
values ('79000000-0000-0000-0000-000000000007', '75000000-0000-0000-0000-000000000001', 'INACTIVE', 'Inactive material', false);
insert into public.inventory_balances (org_id, material_id, location_id, quantity)
values ('75000000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-000000000001', '78000000-0000-0000-0000-000000000001', 10);

insert into public.suppliers (id, org_id, name)
values
  ('80000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'Active supplier'),
  ('80000000-0000-0000-0000-000000000002', '75000000-0000-0000-0000-000000000002', 'Expired supplier');
insert into public.purchase_orders (id, org_id, supplier_id, po_number, status)
values
  ('81000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'PO-SENT', 'sent'),
  ('81000000-0000-0000-0000-000000000002', '75000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'PO-DRAFT', 'draft'),
  ('81000000-0000-0000-0000-000000000003', '75000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', 'PO-EXPIRED', 'sent');
insert into public.po_lines (id, org_id, purchase_order_id, material_id, quantity_ordered)
values
  ('82000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-000000000001', 5),
  ('82000000-0000-0000-0000-000000000002', '75000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', '79000000-0000-0000-0000-000000000001', 5),
  ('82000000-0000-0000-0000-000000000003', '75000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000003', '79000000-0000-0000-0000-000000000002', 5);

insert into public.org_invitations (
  id, org_id, org_name, email, role, invited_by, token_hash, status, expires_at
)
values
  ('83000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'Active RPC org', 'accept@example.test', 'viewer', '76000000-0000-0000-0000-000000000001', 'accept-token', 'pending', now() + interval '1 day'),
  ('83000000-0000-0000-0000-000000000002', '75000000-0000-0000-0000-000000000001', 'Active RPC org', 'reject@example.test', 'member', '76000000-0000-0000-0000-000000000001', 'reject-token', 'pending', now() + interval '1 day'),
  ('83000000-0000-0000-0000-000000000003', '75000000-0000-0000-0000-000000000002', 'Expired RPC org', 'expired@example.test', 'member', '76000000-0000-0000-0000-000000000001', 'expired-token', 'pending', now() + interval '1 day');

update public.organization_billing set status = 'trialing', trial_ends_at = now() - interval '1 day'
where org_id = '75000000-0000-0000-0000-000000000002';
update public.organization_billing set status = 'trialing', trial_ends_at = now() + interval '1 day'
where org_id = '75000000-0000-0000-0000-000000000004';
update public.organization_billing set status = 'past_due', past_due_since = now() - interval '6 days'
where org_id = '75000000-0000-0000-0000-000000000005';
delete from public.organization_billing where org_id = '75000000-0000-0000-0000-000000000006';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"76000000-0000-0000-0000-000000000001","email":"member@example.test","role":"authenticated"}', true);

select is(
  pg_temp.try_sql($$select public.create_stock_movement(
    '75000000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-000000000001',
    '78000000-0000-0000-0000-000000000001', 1, 'adjustment', null, null, null,
    '76000000-0000-0000-0000-000000000001')$$),
  'ok',
  'active member can create a stock movement'
);
select is(
  (select created_by from public.stock_movements where note is null order by created_at desc limit 1),
  '76000000-0000-0000-0000-000000000001'::uuid,
  'stock movement records auth.uid as actor'
);
select is(
  pg_temp.try_sql($$select public.create_stock_transfer(
    '75000000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-000000000001',
    '78000000-0000-0000-0000-000000000001', '78000000-0000-0000-0000-000000000002',
    2, 'Transfer test', '76000000-0000-0000-0000-000000000001')$$),
  'ok',
  'active member can create a stock transfer'
);
select is(
  (select quantity from public.inventory_balances where org_id = '75000000-0000-0000-0000-000000000001' and material_id = '79000000-0000-0000-0000-000000000001' and location_id = '78000000-0000-0000-0000-000000000002'),
  2::numeric,
  'stock transfer applies both balance mutations atomically'
);
select is(
  pg_temp.try_sql($$select * from public.receive_purchase_order(
    '75000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001',
    '76000000-0000-0000-0000-000000000001',
    '[{"po_line_id":"82000000-0000-0000-0000-000000000001","quantity_received":1,"location_id":"78000000-0000-0000-0000-000000000002"}]'::jsonb)$$),
  'ok',
  'active member can receive a sent purchase order'
);
select is((select status::text from public.purchase_orders where id = '81000000-0000-0000-0000-000000000001'), 'partial', 'purchase order receipt persists its status');
select is(
  pg_temp.try_sql($$select * from public.receive_purchase_order(
    '75000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001',
    '76000000-0000-0000-0000-000000000001', null::jsonb)$$),
  'P0001',
  'purchase-order receipt rejects null payloads'
);

select is(
  pg_temp.try_sql($$select public.create_stock_movement(
    '75000000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-000000000001',
    '78000000-0000-0000-0000-000000000001', 1, 'adjustment', null, null, null,
    '76000000-0000-0000-0000-000000000099')$$),
  '42501',
  'stock movement rejects actor spoofing'
);
select is(
  pg_temp.try_sql($$select public.create_stock_movement(
    '75000000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-000000000001',
    '78000000-0000-0000-0000-000000000001', 1, 'purchase_receive', null, null, null,
    '76000000-0000-0000-0000-000000000001')$$),
  '42501',
  'a caller cannot forge a purchase receipt through create_stock_movement'
);
select is(
  pg_temp.try_sql($$select public.create_stock_movement(
    '75000000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-000000000001',
    '78000000-0000-0000-0000-000000000001', 1, 'transfer', null, null, null,
    '76000000-0000-0000-0000-000000000001')$$),
  '42501',
  'a caller cannot forge one leg of a transfer through create_stock_movement'
);
select is(
  pg_temp.try_sql($$select public.create_stock_movement(
    '75000000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-000000000001',
    '78000000-0000-0000-0000-000000000001', 'NaN'::numeric, 'adjustment', null, null, null,
    '76000000-0000-0000-0000-000000000001')$$),
  '22003',
  'a stock movement rejects a non-finite quantity'
);
select is(
  pg_temp.try_sql($$select public.create_stock_transfer(
    '75000000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-000000000001',
    '78000000-0000-0000-0000-000000000001', '78000000-0000-0000-0000-000000000002',
    1, null, '76000000-0000-0000-0000-000000000099')$$),
  '42501',
  'stock transfer rejects actor spoofing'
);
select is(
  pg_temp.try_sql($$select public.create_stock_transfer(
    '75000000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-000000000001',
    '78000000-0000-0000-0000-000000000001', '78000000-0000-0000-0000-000000000002',
    'Infinity'::numeric, null, '76000000-0000-0000-0000-000000000001')$$),
  '22003',
  'a stock transfer rejects a non-finite quantity'
);
select is(
  pg_temp.try_sql($$select public.create_stock_movement(
    '75000000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-000000000007',
    '78000000-0000-0000-0000-000000000001', 1, 'adjustment', null, null, null,
    '76000000-0000-0000-0000-000000000001')$$),
  '42501',
  'inactive materials are rejected by the RPC layer'
);
select is(
  pg_temp.try_sql($$select public.create_stock_transfer(
    '75000000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-000000000001',
    '78000000-0000-0000-0000-000000000001', '78000000-0000-0000-0000-000000000007',
    1, null, '76000000-0000-0000-0000-000000000001')$$),
  '42501',
  'inactive locations are rejected by the RPC layer'
);
select is(
  pg_temp.try_sql($$select * from public.receive_purchase_order(
    '75000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001',
    '76000000-0000-0000-0000-000000000099', '[]'::jsonb)$$),
  '42501',
  'purchase-order receipt rejects actor spoofing'
);
select is(
  pg_temp.try_sql($$select * from public.receive_purchase_order(
    '75000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002',
    '76000000-0000-0000-0000-000000000001',
    '[{"po_line_id":"82000000-0000-0000-0000-000000000002","quantity_received":1,"location_id":"78000000-0000-0000-0000-000000000002"}]'::jsonb)$$),
  'P0001',
  'direct receipt rejects a draft purchase order like the API route'
);

select set_config('request.jwt.claims', '{"sub":"76000000-0000-0000-0000-000000000002","email":"viewer@example.test","role":"authenticated"}', true);
select is(pg_temp.try_sql($$select public.create_stock_movement('75000000-0000-0000-0000-000000000001','79000000-0000-0000-0000-000000000001','78000000-0000-0000-0000-000000000001',1,'adjustment',null,null,null,'76000000-0000-0000-0000-000000000002')$$), '42501', 'viewer cannot call create_stock_movement');
select is(pg_temp.try_sql($$select public.create_stock_transfer('75000000-0000-0000-0000-000000000001','79000000-0000-0000-0000-000000000001','78000000-0000-0000-0000-000000000001','78000000-0000-0000-0000-000000000002',1,null,'76000000-0000-0000-0000-000000000002')$$), '42501', 'viewer cannot call create_stock_transfer');
select is(pg_temp.try_sql($$select * from public.receive_purchase_order('75000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','76000000-0000-0000-0000-000000000002','[]'::jsonb)$$), '42501', 'viewer cannot call receive_purchase_order');

select set_config('request.jwt.claims', '{"sub":"76000000-0000-0000-0000-000000000099","email":"outsider@example.test","role":"authenticated"}', true);
select is(pg_temp.try_sql($$select public.create_stock_movement('75000000-0000-0000-0000-000000000001','79000000-0000-0000-0000-000000000001','78000000-0000-0000-0000-000000000001',1,'adjustment',null,null,null,'76000000-0000-0000-0000-000000000099')$$), '42501', 'active non-member cannot call mutation RPCs');

select set_config('request.jwt.claims', '{"sub":"76000000-0000-0000-0000-000000000001","email":"member@example.test","role":"authenticated"}', true);
select is(pg_temp.try_sql($$select public.create_stock_movement('75000000-0000-0000-0000-000000000002','79000000-0000-0000-0000-000000000002','78000000-0000-0000-0000-000000000003',1,'adjustment',null,null,null,'76000000-0000-0000-0000-000000000001')$$), '42501', 'expired workspace blocks create_stock_movement');
select is(pg_temp.try_sql($$select public.create_stock_transfer('75000000-0000-0000-0000-000000000002','79000000-0000-0000-0000-000000000002','78000000-0000-0000-0000-000000000003','78000000-0000-0000-0000-000000000003',1,null,'76000000-0000-0000-0000-000000000001')$$), '42501', 'expired workspace blocks create_stock_transfer before payload validation');
select is(pg_temp.try_sql($$select * from public.receive_purchase_order('75000000-0000-0000-0000-000000000002','81000000-0000-0000-0000-000000000003','76000000-0000-0000-0000-000000000001','[]'::jsonb)$$), '42501', 'expired workspace blocks empty receive RPC calls');
select is(pg_temp.try_sql($$select public.create_stock_movement('75000000-0000-0000-0000-000000000004','79000000-0000-0000-0000-000000000004','78000000-0000-0000-0000-000000000004',1,'adjustment',null,null,null,'76000000-0000-0000-0000-000000000001')$$), 'ok', 'valid trial retains stock RPC writes');
select is(pg_temp.try_sql($$select public.create_stock_movement('75000000-0000-0000-0000-000000000005','79000000-0000-0000-0000-000000000005','78000000-0000-0000-0000-000000000005',1,'adjustment',null,null,null,'76000000-0000-0000-0000-000000000001')$$), 'ok', 'valid grace retains stock RPC writes');
select is(pg_temp.try_sql($$select public.create_stock_movement('75000000-0000-0000-0000-000000000006','79000000-0000-0000-0000-000000000006','78000000-0000-0000-0000-000000000006',1,'adjustment',null,null,null,'76000000-0000-0000-0000-000000000001')$$), '42501', 'missing billing blocks stock RPC writes');

select set_config('request.jwt.claims', '{"sub":"76000000-0000-0000-0000-000000000010","email":"accept@example.test","role":"authenticated"}', true);
select is(pg_temp.try_sql($$select public.accept_org_invitation('83000000-0000-0000-0000-000000000001')$$), 'ok', 'invitee accepts an active immutable invitation through RPC');
select is((select role::text from public.org_users where org_id = '75000000-0000-0000-0000-000000000001' and user_id = '76000000-0000-0000-0000-000000000010'), 'viewer', 'accept RPC preserves the invited role');
select is(pg_temp.try_sql($$select public.accept_org_invitation('83000000-0000-0000-0000-000000000001')$$), 'P0001', 'accepted invitation cannot be replayed');

select set_config('request.jwt.claims', '{"sub":"76000000-0000-0000-0000-000000000011","email":"reject@example.test","role":"authenticated"}', true);
select is(pg_temp.try_sql($$select public.reject_org_invitation('83000000-0000-0000-0000-000000000002')$$), 'ok', 'invitee rejects an active invitation through RPC');
reset role;
select is((select status from public.org_invitations where id = '83000000-0000-0000-0000-000000000002'), 'revoked', 'reject RPC persists the single transition');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"76000000-0000-0000-0000-000000000012","email":"expired@example.test","role":"authenticated"}', true);
select is(pg_temp.try_sql($$select public.accept_org_invitation('83000000-0000-0000-0000-000000000003')$$), '42501', 'read-only workspace blocks invitation acceptance');

reset role;

select * from finish();

rollback;
