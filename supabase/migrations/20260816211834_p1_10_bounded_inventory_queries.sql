create or replace function public.get_stock_health(p_org_id uuid)
returns table (
  total_materials bigint,
  total_quantity bigint,
  out_of_stock bigint,
  low_stock bigint
)
language sql
security invoker
set search_path = public
as $$
  with material_totals as (
    select
      m.id,
      m.min_stock,
      coalesce(sum(ib.quantity), 0)::bigint as quantity
    from public.materials m
    left join public.inventory_balances ib
      on ib.org_id = m.org_id
     and ib.material_id = m.id
    where m.org_id = p_org_id
      and m.is_active = true
    group by m.id, m.min_stock
  )
  select
    count(*)::bigint as total_materials,
    coalesce(sum(quantity), 0)::bigint as total_quantity,
    count(*) filter (where quantity = 0)::bigint as out_of_stock,
    count(*) filter (where quantity <= min_stock)::bigint as low_stock
  from material_totals;
$$;
revoke all on function public.get_stock_health(uuid) from public;
grant execute on function public.get_stock_health(uuid) to authenticated;

create or replace function public.get_low_stock_materials(p_org_id uuid)
returns table (
  material_id uuid,
  sku text,
  name text,
  min_stock bigint,
  quantity bigint,
  deficit bigint
)
language sql
security invoker
set search_path = public
as $$
  with material_totals as (
    select
      m.id,
      m.sku,
      m.name,
      m.min_stock,
      coalesce(sum(ib.quantity), 0)::bigint as quantity
    from public.materials m
    left join public.inventory_balances ib
      on ib.org_id = m.org_id
     and ib.material_id = m.id
    where m.org_id = p_org_id
      and m.is_active = true
    group by m.id, m.sku, m.name, m.min_stock
  )
  select
    id as material_id,
    sku,
    name,
    min_stock,
    quantity,
    greatest(0, min_stock - quantity)::bigint as deficit
  from material_totals
  where quantity <= min_stock
  order by sku asc, name asc;
$$;
revoke all on function public.get_low_stock_materials(uuid) from public;
grant execute on function public.get_low_stock_materials(uuid) to authenticated;
