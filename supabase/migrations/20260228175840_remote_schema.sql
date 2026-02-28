drop extension if exists "pg_net";

alter table "public"."purchase_orders" drop constraint "purchase_orders_currency_check";

alter table "public"."purchase_orders" drop column "currency";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_organization_with_owner(p_name text)
 RETURNS public.organizations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_org public.organizations;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Organization name is required';
  end if;

  insert into public.organizations (name)
  values (trim(p_name))
  returning * into v_org;

  insert into public.org_users (org_id, user_id, role)
  values (v_org.id, v_user_id, 'owner');

  return v_org;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_stock_movement(p_org_id uuid, p_material_id uuid, p_location_id uuid, p_quantity_delta numeric, p_reason public.movement_reason, p_note text DEFAULT NULL::text, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid, p_created_by uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  insert into public.inventory_balances (org_id, material_id, location_id, quantity)
  values (p_org_id, p_material_id, p_location_id, p_quantity_delta)
  on conflict (org_id, material_id, location_id)
  do update
    set quantity = public.inventory_balances.quantity + excluded.quantity,
        updated_at = timezone('utc', now());

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
$function$
;

CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.org_users ou
    where ou.org_id = target_org_id
      and ou.user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.receive_purchase_order(p_org_id uuid, p_po_id uuid, p_received_by uuid, p_receipts jsonb)
 RETURNS TABLE(po_status public.po_status, total_lines integer, fully_received_lines integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_po record;
  v_item jsonb;
  v_line record;
  v_qty numeric(14, 3);
  v_location_id uuid;
  v_status public.po_status;
begin
  if jsonb_typeof(p_receipts) <> 'array' then
    raise exception 'receipts must be a JSON array';
  end if;

  select *
  into v_po
  from public.purchase_orders
  where id = p_po_id and org_id = p_org_id
  for update;

  if not found then
    raise exception 'Purchase order not found in this organization';
  end if;

  if v_po.status = 'cancelled' then
    raise exception 'Cancelled purchase orders cannot be received';
  end if;

  for v_item in
    select value from jsonb_array_elements(p_receipts)
  loop
    v_qty := (v_item ->> 'quantity_received')::numeric;
    v_location_id := (v_item ->> 'location_id')::uuid;

    if v_qty is null or v_qty <= 0 then
      raise exception 'quantity_received must be greater than zero';
    end if;

    select *
    into v_line
    from public.po_lines
    where id = (v_item ->> 'po_line_id')::uuid
      and purchase_order_id = p_po_id
      and org_id = p_org_id
    for update;

    if not found then
      raise exception 'PO line does not exist in this purchase order';
    end if;

    if v_line.quantity_received + v_qty > v_line.quantity_ordered then
      raise exception 'Receiving quantity exceeds quantity_ordered for line %', v_line.id;
    end if;

    update public.po_lines
    set quantity_received = quantity_received + v_qty
    where id = v_line.id;

    perform public.create_stock_movement(
      p_org_id,
      v_line.material_id,
      v_location_id,
      v_qty,
      'purchase_receive',
      'Received from purchase order',
      'purchase_order',
      p_po_id,
      p_received_by
    );
  end loop;

  select
    count(*)::integer,
    count(*) filter (where quantity_received >= quantity_ordered)::integer
  into total_lines, fully_received_lines
  from public.po_lines
  where purchase_order_id = p_po_id and org_id = p_org_id;

  if fully_received_lines = total_lines then
    v_status := 'received';
  else
    v_status := 'partial';
  end if;

  update public.purchase_orders
  set status = v_status,
      received_at = case when v_status = 'received' then timezone('utc', now()) else received_at end,
      updated_at = timezone('utc', now())
  where id = p_po_id;

  return query
  select v_status, total_lines, fully_received_lines;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$function$
;


