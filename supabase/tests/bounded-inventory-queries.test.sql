begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into public.organizations (id, name)
values
  ('88000000-0000-0000-0000-000000000001', 'Inventory Query Org A'),
  ('88000000-0000-0000-0000-000000000002', 'Inventory Query Org B');

insert into public.organization_billing (org_id, plan, status, billing_interval)
values
  ('88000000-0000-0000-0000-000000000001', 'operations', 'active', 'monthly'),
  ('88000000-0000-0000-0000-000000000002', 'operations', 'active', 'monthly');

insert into public.org_users (org_id, user_id, role)
values
  ('88000000-0000-0000-0000-000000000001', '89000000-0000-0000-0000-000000000001', 'owner'),
  ('88000000-0000-0000-0000-000000000002', '89000000-0000-0000-0000-000000000001', 'owner');

insert into public.locations (id, org_id, code, name)
values
  ('8a000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-000000000001', 'A1', 'Alpha'),
  ('8a000000-0000-0000-0000-000000000002', '88000000-0000-0000-0000-000000000001', 'A2', 'Beta'),
  ('8a000000-0000-0000-0000-000000000003', '88000000-0000-0000-0000-000000000002', 'B1', 'Gamma');

insert into public.materials (id, org_id, sku, name, min_stock)
values
  ('8b000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-000000000001', 'SKU-A', 'Alpha bolts', 10),
  ('8b000000-0000-0000-0000-000000000002', '88000000-0000-0000-0000-000000000001', 'SKU-B', 'Beta bolts', 5),
  ('8b000000-0000-0000-0000-000000000004', '88000000-0000-0000-0000-000000000002', 'SKU-Z', 'Other bolts', 1);

insert into public.materials (id, org_id, sku, name, min_stock, is_active)
values
  ('8b000000-0000-0000-0000-000000000003', '88000000-0000-0000-0000-000000000001', 'SKU-C', 'Hidden bolts', 1, false);

insert into public.inventory_balances (org_id, material_id, location_id, quantity)
values
  ('88000000-0000-0000-0000-000000000001', '8b000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-000000000001', 4),
  ('88000000-0000-0000-0000-000000000001', '8b000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-000000000002', 1),
  ('88000000-0000-0000-0000-000000000001', '8b000000-0000-0000-0000-000000000002', '8a000000-0000-0000-0000-000000000001', 0),
  ('88000000-0000-0000-0000-000000000002', '8b000000-0000-0000-0000-000000000004', '8a000000-0000-0000-0000-000000000003', 12);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"89000000-0000-0000-0000-000000000001","email":"owner@example.test","role":"authenticated"}',
  true
);

select is(
  (select total_materials from public.get_stock_health('88000000-0000-0000-0000-000000000001')),
  2::bigint,
  'stock health counts only active materials for the requested org'
);
select is(
  (select total_quantity from public.get_stock_health('88000000-0000-0000-0000-000000000001')),
  5::bigint,
  'stock health sums quantities in SQL'
);
select is(
  (select out_of_stock from public.get_stock_health('88000000-0000-0000-0000-000000000001')),
  1::bigint,
  'stock health counts empty materials in SQL'
);
select is(
  (select low_stock from public.get_stock_health('88000000-0000-0000-0000-000000000001')),
  2::bigint,
  'stock health counts low-stock materials in SQL'
);
select set_eq(
  $$
    select material_id::text
    from public.get_low_stock_materials('88000000-0000-0000-0000-000000000001')
  $$,
  $$ values
    ('8b000000-0000-0000-0000-000000000001'::text),
    ('8b000000-0000-0000-0000-000000000002'::text)
  $$,
  'low-stock query returns exactly the expected materials'
);
select is(
  (select deficit from public.get_low_stock_materials('88000000-0000-0000-0000-000000000001') where material_id = '8b000000-0000-0000-0000-000000000001'),
  5::bigint,
  'low-stock query computes the correct deficit for the partially stocked material'
);
select is(
  (select deficit from public.get_low_stock_materials('88000000-0000-0000-0000-000000000001') where material_id = '8b000000-0000-0000-0000-000000000002'),
  5::bigint,
  'low-stock query computes the correct deficit for the out-of-stock material'
);
select is(
  (select count(*) from public.get_low_stock_materials('88000000-0000-0000-0000-000000000002')),
  0::bigint,
  'low-stock query stays isolated to the requested tenant'
);

select * from finish();

rollback;
