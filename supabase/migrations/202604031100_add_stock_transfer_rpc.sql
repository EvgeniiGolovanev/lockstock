alter type public.movement_reason add value if not exists 'transfer';

create or replace function public.create_stock_transfer(
  p_org_id uuid,
  p_material_id uuid,
  p_from_location_id uuid,
  p_to_location_id uuid,
  p_quantity numeric,
  p_note text default null,
  p_created_by uuid default null
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_out_movement_id uuid;
  v_in_movement_id uuid;
begin
  if p_quantity <= 0 then
    raise exception 'quantity must be greater than zero';
  end if;

  if p_from_location_id = p_to_location_id then
    raise exception 'Transfer locations must be different';
  end if;

  v_out_movement_id := public.create_stock_movement(
    p_org_id,
    p_material_id,
    p_from_location_id,
    p_quantity * -1,
    'transfer',
    p_note,
    null,
    null,
    p_created_by
  );

  v_in_movement_id := public.create_stock_movement(
    p_org_id,
    p_material_id,
    p_to_location_id,
    p_quantity,
    'transfer',
    p_note,
    null,
    null,
    p_created_by
  );

  return array[v_out_movement_id, v_in_movement_id];
end;
$$;
