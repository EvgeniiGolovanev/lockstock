-- Keep supported inventory commands in organization -> stock/row lock order.
-- CREATE OR REPLACE preserves the existing signatures, authorization and ACLs.

create or replace function public.apply_stock_movement_internal(
  p_org_id uuid,
  p_material_id uuid,
  p_location_id uuid,
  p_quantity_delta numeric,
  p_reason public.movement_reason,
  p_note text,
  p_reference_type text,
  p_reference_id uuid,
  p_actor uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing_balance numeric(14, 3);
  v_new_balance numeric(14, 3);
  v_movement_id uuid := gen_random_uuid();
begin
  -- Acquire the replenishment boundary before stock and PO row locks.
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));

  perform pg_advisory_xact_lock(hashtextextended('stock-org:' || p_org_id::text, 0));

  if p_actor is null then
    raise exception using errcode = '42501', message = 'Authenticated user required';
  end if;
  if p_quantity_delta is null
     or p_quantity_delta::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = '22003', message = 'quantity_delta must be finite';
  end if;
  if p_quantity_delta = 0 then
    raise exception using errcode = '22023', message = 'quantity_delta cannot be zero';
  end if;

  perform 1
  from public.materials
  where id = p_material_id and org_id = p_org_id and is_active;
  if not found then
    raise exception using errcode = '42501', message = 'Material must be active in this organization';
  end if;

  perform 1
  from public.locations
  where id = p_location_id and org_id = p_org_id and is_active;
  if not found then
    raise exception using errcode = '42501', message = 'Location must be active in this organization';
  end if;

  select quantity
  into v_existing_balance
  from public.inventory_balances
  where org_id = p_org_id
    and material_id = p_material_id
    and location_id = p_location_id
  for update;

  if not found then
    v_existing_balance := 0;
  end if;

  v_new_balance := v_existing_balance + p_quantity_delta;
  if v_new_balance < 0 then
    raise exception using errcode = '23514', message = 'Insufficient stock for this movement';
  end if;

  if exists (
    select 1 from public.inventory_balances
    where org_id = p_org_id
      and material_id = p_material_id
      and location_id = p_location_id
  ) then
    update public.inventory_balances
    set quantity = v_new_balance, updated_at = timezone('utc', now())
    where org_id = p_org_id
      and material_id = p_material_id
      and location_id = p_location_id;
  else
    insert into public.inventory_balances (org_id, material_id, location_id, quantity)
    values (p_org_id, p_material_id, p_location_id, v_new_balance);
  end if;

  insert into public.stock_movements (
    id, org_id, material_id, location_id, quantity_delta, reason, note,
    reference_type, reference_id, created_by
  ) values (
    v_movement_id, p_org_id, p_material_id, p_location_id, p_quantity_delta,
    p_reason, p_note, p_reference_type, p_reference_id, p_actor
  );

  return v_movement_id;
end;
$$;

create or replace function public.receive_purchase_order(
  p_org_id uuid,
  p_po_id uuid,
  p_received_by uuid,
  p_receipts jsonb
)
returns table (po_status public.po_status, total_lines integer, fully_received_lines integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_po record;
  v_item jsonb;
  v_line record;
  v_qty numeric;
  v_location_id uuid;
  v_status public.po_status;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authenticated user required';
  end if;
  if p_received_by is not null and p_received_by is distinct from v_actor then
    raise exception using errcode = '42501', message = 'Actor id must match authenticated user';
  end if;
  if not public.is_org_role_at_least(p_org_id, 'member') then
    raise exception using errcode = '42501', message = 'This action requires member role or higher';
  end if;
  if not public.workspace_has_write_access(p_org_id) then
    raise exception using
      errcode = '42501',
      message = 'This workspace is read-only because its trial or subscription is not active.';
  end if;
  if p_receipts is null or jsonb_typeof(p_receipts) <> 'array' or jsonb_array_length(p_receipts) = 0 then
    raise exception 'receipts must be a non-empty JSON array';
  end if;

  -- Acquire the replenishment boundary before stock and PO row locks.
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));

  select * into v_po
  from public.purchase_orders
  where id = p_po_id and org_id = p_org_id
  for update;
  if not found then raise exception 'Purchase order not found in this organization'; end if;
  if v_po.status in ('draft', 'cancelled') then
    raise exception 'Purchase order must be sent before receiving';
  end if;

  for v_item in select value from jsonb_array_elements(p_receipts)
  loop
    v_qty := (v_item ->> 'quantity_received')::numeric;
    v_location_id := (v_item ->> 'location_id')::uuid;
    if v_qty is null or v_qty::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception using errcode = '22003', message = 'quantity_received must be finite';
    end if;
    if v_qty <= 0 then raise exception 'quantity_received must be greater than zero'; end if;

    select * into v_line
    from public.po_lines
    where id = (v_item ->> 'po_line_id')::uuid
      and purchase_order_id = p_po_id
      and org_id = p_org_id
    for update;
    if not found then raise exception 'PO line does not exist in this purchase order'; end if;
    if v_line.quantity_received + v_qty > v_line.quantity_ordered then
      raise exception 'Receiving quantity exceeds quantity_ordered for line %', v_line.id;
    end if;

    update public.po_lines set quantity_received = quantity_received + v_qty where id = v_line.id;
    perform public.apply_stock_movement_internal(
      p_org_id, v_line.material_id, v_location_id, v_qty, 'purchase_receive',
      'Received from purchase order', 'purchase_order', p_po_id, v_actor
    );
  end loop;

  select count(*)::integer,
         count(*) filter (where quantity_received >= quantity_ordered)::integer
  into total_lines, fully_received_lines
  from public.po_lines
  where purchase_order_id = p_po_id and org_id = p_org_id;

  v_status := case when fully_received_lines = total_lines then 'received' else 'partial' end;
  update public.purchase_orders
  set status = v_status,
      received_at = case when v_status = 'received' then now() else received_at end,
      updated_at = now()
  where id = p_po_id;

  return query select v_status, total_lines, fully_received_lines;
end;
$$;

create or replace function public.transition_purchase_order_status(
  p_org_id uuid,
  p_po_id uuid,
  p_status public.po_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_po public.purchase_orders;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authenticated user required';
  end if;
  if not public.is_org_role_at_least(p_org_id, 'manager') then
    raise exception using errcode = '42501', message = 'This action requires manager role or higher';
  end if;
  if not public.workspace_has_write_access(p_org_id) then
    raise exception using
      errcode = '42501',
      message = 'This workspace is read-only because its trial or subscription is not active.';
  end if;

  -- Acquire the replenishment boundary before stock and PO row locks.
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));

  select *
  into v_po
  from public.purchase_orders
  where id = p_po_id
    and org_id = p_org_id
  for update;
  if not found then
    raise exception 'Purchase order not found.';
  end if;

  if p_status = 'sent' then
    if v_po.status <> 'draft' then
      raise exception 'Invalid status transition: % -> %', v_po.status, p_status;
    end if;
    update public.purchase_orders
    set status = p_status,
        sent_at = now(),
        updated_at = now()
    where id = v_po.id
    returning * into v_po;
  elsif p_status = 'cancelled' then
    if v_po.status not in ('draft', 'sent', 'partial') then
      raise exception 'Invalid status transition: % -> %', v_po.status, p_status;
    end if;
    update public.purchase_orders
    set status = p_status,
        updated_at = now()
    where id = v_po.id
    returning * into v_po;
  else
    raise exception 'Invalid status transition: % -> %', v_po.status, p_status;
  end if;

  return jsonb_build_object(
    'id', v_po.id,
    'po_number', v_po.po_number,
    'status', v_po.status,
    'sent_at', v_po.sent_at
  );
end;
$$;
