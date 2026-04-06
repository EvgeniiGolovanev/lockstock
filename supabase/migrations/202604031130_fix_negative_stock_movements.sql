create or replace function public.create_stock_movement(
  p_org_id uuid,
  p_material_id uuid,
  p_location_id uuid,
  p_quantity_delta numeric,
  p_reason public.movement_reason,
  p_note text default null,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing numeric(14, 3);
  v_new_balance numeric(14, 3);
  v_movement_id uuid := gen_random_uuid();
begin
  if p_quantity_delta = 0 then
    raise exception 'quantity_delta cannot be zero';
  end if;

  perform 1
  from public.materials
  where id = p_material_id and org_id = p_org_id;
  if not found then
    raise exception 'Material does not exist in this organization';
  end if;

  perform 1
  from public.locations
  where id = p_location_id and org_id = p_org_id;
  if not found then
    raise exception 'Location does not exist in this organization';
  end if;

  select quantity
  into v_existing
  from public.inventory_balances
  where org_id = p_org_id and material_id = p_material_id and location_id = p_location_id
  for update;

  if not found then
    v_existing := 0;
  end if;

  v_new_balance := v_existing + p_quantity_delta;

  if v_new_balance < 0 then
    raise exception 'Insufficient stock for this movement';
  end if;

  if exists (
    select 1
    from public.inventory_balances
    where org_id = p_org_id and material_id = p_material_id and location_id = p_location_id
  ) then
    update public.inventory_balances
    set quantity = v_new_balance,
        updated_at = timezone('utc', now())
    where org_id = p_org_id and material_id = p_material_id and location_id = p_location_id;
  else
    insert into public.inventory_balances (org_id, material_id, location_id, quantity)
    values (p_org_id, p_material_id, p_location_id, v_new_balance);
  end if;

  insert into public.stock_movements (
    id,
    org_id,
    material_id,
    location_id,
    quantity_delta,
    reason,
    note,
    reference_type,
    reference_id,
    created_by
  )
  values (
    v_movement_id,
    p_org_id,
    p_material_id,
    p_location_id,
    p_quantity_delta,
    p_reason,
    p_note,
    p_reference_type,
    p_reference_id,
    p_created_by
  );

  return v_movement_id;
end;
$$;
