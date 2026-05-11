create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_row jsonb;
  v_old_row jsonb;
  v_org_id uuid;
  v_entity_type text;
  v_entity_id uuid;
  v_entity_label text;
  v_message text;
  v_metadata jsonb := '{}'::jsonb;
  v_changed_fields text[] := array[]::text[];
  v_old_values jsonb := '{}'::jsonb;
  v_new_values jsonb := '{}'::jsonb;
  v_excluded_fields text[] := array[
    'id',
    'org_id',
    'created_at',
    'updated_at',
    'token_hash',
    'accepted_at',
    'sent_at',
    'received_at'
  ];
  v_pair record;
  v_material jsonb;
  v_location jsonb;
  v_supplier jsonb;
  v_purchase_order jsonb;
  v_team jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := 'created';
    v_row := to_jsonb(new);
    v_old_row := '{}'::jsonb;
  elsif tg_op = 'UPDATE' then
    v_action := 'updated';
    v_row := to_jsonb(new);
    v_old_row := to_jsonb(old);
  elsif tg_op = 'DELETE' then
    v_action := 'deleted';
    v_row := to_jsonb(old);
    v_old_row := to_jsonb(old);
  else
    return null;
  end if;

  if tg_table_name = 'team_members' then
    select t.org_id
    into v_org_id
    from public.teams t
    where t.id = (v_row ->> 'team_id')::uuid;
  else
    v_org_id := (v_row ->> 'org_id')::uuid;
  end if;

  if v_org_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if not exists (select 1 from public.organizations o where o.id = v_org_id) then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    for v_pair in
      select key, value
      from jsonb_each(v_row)
      where key <> all(v_excluded_fields)
    loop
      if (v_old_row -> v_pair.key) is distinct from v_pair.value then
        v_changed_fields := array_append(v_changed_fields, v_pair.key);
        v_old_values := v_old_values || jsonb_build_object(v_pair.key, v_old_row -> v_pair.key);
        v_new_values := v_new_values || jsonb_build_object(v_pair.key, v_pair.value);
      end if;
    end loop;
  elsif tg_op = 'INSERT' then
    for v_pair in
      select key, value
      from jsonb_each(v_row)
      where key <> all(v_excluded_fields)
        and value <> 'null'::jsonb
    loop
      v_changed_fields := array_append(v_changed_fields, v_pair.key);
      v_new_values := v_new_values || jsonb_build_object(v_pair.key, v_pair.value);
    end loop;
  elsif tg_op = 'DELETE' then
    for v_pair in
      select key, value
      from jsonb_each(v_row)
      where key <> all(v_excluded_fields)
        and value <> 'null'::jsonb
    loop
      v_changed_fields := array_append(v_changed_fields, v_pair.key);
      v_old_values := v_old_values || jsonb_build_object(v_pair.key, v_pair.value);
    end loop;
  end if;

  if tg_table_name = 'materials' then
    v_entity_type := 'material';
    v_entity_id := (v_row ->> 'id')::uuid;
    v_entity_label := coalesce(v_row ->> 'sku', v_row ->> 'name');
    v_material := jsonb_strip_nulls(jsonb_build_object(
      'id', v_entity_id,
      'sku', v_row ->> 'sku',
      'name', v_row ->> 'name',
      'uom', v_row ->> 'uom'
    ));
  elsif tg_table_name = 'locations' then
    v_entity_type := 'location';
    v_entity_id := (v_row ->> 'id')::uuid;
    v_entity_label := coalesce(v_row ->> 'code', v_row ->> 'name');
    v_location := jsonb_strip_nulls(jsonb_build_object(
      'id', v_entity_id,
      'code', v_row ->> 'code',
      'name', v_row ->> 'name'
    ));
  elsif tg_table_name = 'suppliers' then
    v_entity_type := 'supplier';
    v_entity_id := (v_row ->> 'id')::uuid;
    v_entity_label := v_row ->> 'name';
    v_supplier := jsonb_strip_nulls(jsonb_build_object(
      'id', v_entity_id,
      'name', v_row ->> 'name',
      'vendor_number', v_row ->> 'vendor_number'
    ));
  elsif tg_table_name = 'stock_movements' then
    v_entity_type := 'stock_movement';
    v_entity_id := (v_row ->> 'id')::uuid;

    select jsonb_strip_nulls(jsonb_build_object('id', m.id, 'sku', m.sku, 'name', m.name, 'uom', m.uom))
    into v_material
    from public.materials m
    where m.id = (v_row ->> 'material_id')::uuid;

    select jsonb_strip_nulls(jsonb_build_object('id', l.id, 'code', l.code, 'name', l.name))
    into v_location
    from public.locations l
    where l.id = (v_row ->> 'location_id')::uuid;

    v_entity_label := coalesce(v_material ->> 'sku', v_row ->> 'reason');
  elsif tg_table_name = 'purchase_orders' then
    v_entity_type := 'purchase_order';
    v_entity_id := (v_row ->> 'id')::uuid;
    v_entity_label := v_row ->> 'po_number';
    v_purchase_order := jsonb_strip_nulls(jsonb_build_object(
      'id', v_entity_id,
      'po_number', v_row ->> 'po_number',
      'status', v_row ->> 'status',
      'currency', v_row ->> 'currency'
    ));

    select jsonb_strip_nulls(jsonb_build_object('id', s.id, 'name', s.name, 'vendor_number', s.vendor_number))
    into v_supplier
    from public.suppliers s
    where s.id = (v_row ->> 'supplier_id')::uuid;
  elsif tg_table_name = 'po_lines' then
    v_entity_type := 'purchase_order_line';
    v_entity_id := (v_row ->> 'id')::uuid;

    select jsonb_strip_nulls(jsonb_build_object('id', m.id, 'sku', m.sku, 'name', m.name, 'uom', m.uom))
    into v_material
    from public.materials m
    where m.id = (v_row ->> 'material_id')::uuid;

    select jsonb_strip_nulls(jsonb_build_object('id', po.id, 'po_number', po.po_number, 'status', po.status))
    into v_purchase_order
    from public.purchase_orders po
    where po.id = (v_row ->> 'purchase_order_id')::uuid;

    v_entity_label := coalesce(v_purchase_order ->> 'po_number', v_material ->> 'sku');
  elsif tg_table_name = 'org_users' then
    v_entity_type := 'member';
    v_entity_id := (v_row ->> 'user_id')::uuid;
    v_entity_label := coalesce(v_row ->> 'role', v_row ->> 'user_id');
  elsif tg_table_name = 'org_invitations' then
    v_entity_type := 'invitation';
    v_entity_id := (v_row ->> 'id')::uuid;
    v_entity_label := v_row ->> 'email';
  elsif tg_table_name = 'teams' then
    v_entity_type := 'team';
    v_entity_id := (v_row ->> 'id')::uuid;
    v_entity_label := v_row ->> 'name';
    v_team := jsonb_strip_nulls(jsonb_build_object('id', v_entity_id, 'name', v_row ->> 'name'));
  elsif tg_table_name = 'team_members' then
    v_entity_type := 'team_member';
    v_entity_id := (v_row ->> 'user_id')::uuid;

    select jsonb_strip_nulls(jsonb_build_object('id', t.id, 'name', t.name))
    into v_team
    from public.teams t
    where t.id = (v_row ->> 'team_id')::uuid;

    v_entity_label := coalesce(v_team ->> 'name', v_row ->> 'team_id');
  else
    return null;
  end if;

  v_message := initcap(replace(v_entity_type, '_', ' ')) || ' ' || v_action ||
    case when v_entity_label is null or v_entity_label = '' then '' else ': ' || v_entity_label end;

  v_metadata := jsonb_strip_nulls(jsonb_build_object(
    'actor_email', auth.jwt() ->> 'email',
    'changed_fields', to_jsonb(v_changed_fields),
    'old_values', nullif(v_old_values, '{}'::jsonb),
    'new_values', nullif(v_new_values, '{}'::jsonb),
    'material', v_material,
    'location', v_location,
    'supplier', v_supplier,
    'purchase_order', v_purchase_order,
    'team', v_team,
    'quantity_delta', v_row ->> 'quantity_delta',
    'reason', v_row ->> 'reason',
    'email', v_row ->> 'email',
    'reference_type', v_row ->> 'reference_type',
    'reference_id', v_row ->> 'reference_id'
  ));

  insert into public.audit_log (
    org_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    entity_label,
    message,
    metadata
  )
  values (
    v_org_id,
    auth.uid(),
    v_action,
    v_entity_type,
    v_entity_id,
    v_entity_label,
    v_message,
    coalesce(v_metadata, '{}'::jsonb)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;
