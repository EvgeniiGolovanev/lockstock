create or replace function public.create_purchase_order_with_lines(
  p_org_id uuid,
  p_supplier_id uuid,
  p_po_number text,
  p_currency text,
  p_expected_at date,
  p_notes text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_po public.purchase_orders;
  v_line jsonb;
  v_line_row public.po_lines%rowtype;
  v_lines jsonb := '[]'::jsonb;
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
  if p_supplier_id is null then
    raise exception 'Purchase orders require a supplier';
  end if;
  if p_po_number is null or length(trim(p_po_number)) = 0 then
    raise exception 'Purchase order number is required';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Purchase order lines are required';
  end if;
  if p_currency is null or p_currency not in ('EUR', 'USD') then
    raise exception 'Unsupported purchase order currency';
  end if;

  perform 1
  from public.suppliers
  where id = p_supplier_id
    and org_id = p_org_id
    and is_active = true;
  if not found then
    raise exception 'Purchase orders can only use active suppliers.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) as line(value)
    where not exists (
      select 1
      from public.materials
      where id = (line.value ->> 'material_id')::uuid
        and org_id = p_org_id
        and is_active = true
    )
  ) then
    raise exception 'Purchase orders can only use active materials.';
  end if;

  insert into public.purchase_orders (
    org_id,
    supplier_id,
    currency,
    po_number,
    expected_at,
    notes,
    created_by,
    status
  )
  values (
    p_org_id,
    p_supplier_id,
    p_currency,
    trim(p_po_number),
    p_expected_at,
    p_notes,
    v_actor,
    'draft'
  )
  returning * into v_po;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    insert into public.po_lines (
      org_id,
      purchase_order_id,
      material_id,
      quantity_ordered,
      unit_price
    )
    values (
      p_org_id,
      v_po.id,
      (v_line ->> 'material_id')::uuid,
      (v_line ->> 'quantity_ordered')::numeric,
      case when v_line ? 'unit_price' then (v_line ->> 'unit_price')::numeric else null end
    )
    returning * into v_line_row;

    v_lines := v_lines || jsonb_build_array(to_jsonb(v_line_row));
  end loop;

  return to_jsonb(v_po) || jsonb_build_object('lines', v_lines);
end;
$$;

revoke all on function public.create_purchase_order_with_lines(
  uuid, uuid, text, text, date, text, jsonb
) from public, anon;
grant execute on function public.create_purchase_order_with_lines(
  uuid, uuid, text, text, date, text, jsonb
) to authenticated;

create or replace function public.create_team_with_owner(
  p_org_id uuid,
  p_name text,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_team public.teams;
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
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Team name is required';
  end if;

  insert into public.teams (org_id, name, description, created_by)
  values (p_org_id, trim(p_name), nullif(trim(coalesce(p_description, '')), ''), v_actor)
  returning * into v_team;

  insert into public.team_members (team_id, user_id, created_by)
  values (v_team.id, v_actor, v_actor);

  return to_jsonb(v_team);
end;
$$;

revoke all on function public.create_team_with_owner(uuid, text, text) from public, anon;
grant execute on function public.create_team_with_owner(uuid, text, text) to authenticated;

create or replace function public.remove_org_member_with_team_memberships(
  p_org_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target_role text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authenticated user required';
  end if;
  if p_target_user_id is null then
    raise exception 'Target user is required';
  end if;
  if not public.is_org_role_at_least(p_org_id, 'owner') then
    raise exception using errcode = '42501', message = 'This action requires owner role';
  end if;
  if not public.workspace_has_write_access(p_org_id) then
    raise exception using
      errcode = '42501',
      message = 'This workspace is read-only because its trial or subscription is not active.';
  end if;
  if p_target_user_id = v_actor then
    raise exception 'Owners cannot remove themselves from organization.';
  end if;

  select role
  into v_target_role
  from public.org_users
  where org_id = p_org_id
    and user_id = p_target_user_id
  for update;

  if not found then
    raise exception 'Organization member not found.';
  end if;

  if v_target_role = 'owner' then
    raise exception 'Cannot remove an owner from organization.';
  end if;

  delete from public.team_members
  where user_id = p_target_user_id
    and team_id in (
      select id
      from public.teams
      where org_id = p_org_id
    );

  delete from public.org_users
  where org_id = p_org_id
    and user_id = p_target_user_id;

  return jsonb_build_object('user_id', p_target_user_id, 'removed', true);
end;
$$;

revoke all on function public.remove_org_member_with_team_memberships(uuid, uuid) from public, anon;
grant execute on function public.remove_org_member_with_team_memberships(uuid, uuid) to authenticated;
