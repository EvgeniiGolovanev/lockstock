begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

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
values ('84000000-0000-0000-0000-000000000001', 'UTC limit org');
insert into public.organization_billing (org_id, plan, status, billing_interval)
values ('84000000-0000-0000-0000-000000000001', 'starter', 'active', 'monthly');
insert into public.org_users (org_id, user_id, role)
values ('84000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', 'owner');
insert into public.suppliers (id, org_id, name)
values ('86000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', 'UTC supplier');

insert into public.purchase_orders (org_id, supplier_id, po_number, created_at)
select
  '84000000-0000-0000-0000-000000000001',
  '86000000-0000-0000-0000-000000000001',
  'UTC-' || series,
  (date_trunc('month', now() at time zone 'UTC') + interval '1 hour') at time zone 'UTC'
from generate_series(1, 50) as series;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"85000000-0000-0000-0000-000000000001","email":"utc-owner@example.test","role":"authenticated"}',
  true
);
set local time zone 'Pacific/Honolulu';

select is(
  pg_temp.try_sql($$insert into public.purchase_orders (org_id, supplier_id, po_number)
    values (
      '84000000-0000-0000-0000-000000000001',
      '86000000-0000-0000-0000-000000000001',
      'UTC-OVER-LIMIT'
    )$$),
  '23514',
  'monthly purchase-order limit uses UTC boundaries regardless of session time zone'
);

select is(
  pg_temp.try_sql($$insert into public.materials (org_id, sku, name)
    select '84000000-0000-0000-0000-000000000001', 'CAP-' || series, 'Cap ' || series
    from generate_series(1, 500) as series$$),
  'ok',
  'finite material limit accepts rows through the exact boundary'
);

select is(
  pg_temp.try_sql($$insert into public.materials (org_id, sku, name)
    values ('84000000-0000-0000-0000-000000000001', 'CAP-501', 'Over cap')$$),
  '23514',
  'finite material limit rejects the first row above the boundary'
);

select is(
  pg_temp.try_sql($$insert into public.materials (org_id, sku, name, created_by)
    values (
      '84000000-0000-0000-0000-000000000001',
      'CAP-1',
      'Updated at cap',
      '85000000-0000-0000-0000-000000000001'
    )
    on conflict (org_id, sku) do update
      set name = excluded.name, created_by = excluded.created_by$$),
  'ok',
  'an existing material can be upserted at the exact plan cap'
);

select ok(
  not has_table_privilege('authenticated', 'public.purchase_orders', 'delete'),
  'monthly purchase-order quota cannot be replenished by direct deletion'
);

select set_eq(
  $$
    select conname::text
    from pg_constraint
    where conname in ('fk_stock_movements_material_org', 'fk_stock_movements_location_org')
      and confdeltype = 'r'
  $$,
  $$ values
    ('fk_stock_movements_material_org'::text),
    ('fk_stock_movements_location_org'::text)
  $$,
  'parent deletion cannot erase stock-movement usage history by cascade'
);

select * from finish();

rollback;
