create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid default auth.uid(),
  action text not null check (action in ('created', 'updated', 'deleted')),
  entity_type text not null,
  entity_id uuid,
  entity_label text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_audit_log_org_created
  on public.audit_log (org_id, created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists org_select_audit_log on public.audit_log;
create policy org_select_audit_log on public.audit_log
for select using (public.is_org_member(org_id));

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
  v_metadata jsonb;
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

  if tg_table_name = 'materials' then
    v_entity_type := 'material';
    v_entity_id := (v_row ->> 'id')::uuid;
    v_entity_label := coalesce(v_row ->> 'sku', v_row ->> 'name');
  elsif tg_table_name = 'locations' then
    v_entity_type := 'location';
    v_entity_id := (v_row ->> 'id')::uuid;
    v_entity_label := coalesce(v_row ->> 'code', v_row ->> 'name');
  elsif tg_table_name = 'suppliers' then
    v_entity_type := 'supplier';
    v_entity_id := (v_row ->> 'id')::uuid;
    v_entity_label := v_row ->> 'name';
  elsif tg_table_name = 'stock_movements' then
    v_entity_type := 'stock_movement';
    v_entity_id := (v_row ->> 'id')::uuid;
    v_entity_label := v_row ->> 'reason';
  elsif tg_table_name = 'purchase_orders' then
    v_entity_type := 'purchase_order';
    v_entity_id := (v_row ->> 'id')::uuid;
    v_entity_label := v_row ->> 'po_number';
  elsif tg_table_name = 'org_users' then
    v_entity_type := 'member';
    v_entity_id := (v_row ->> 'user_id')::uuid;
    v_entity_label := v_row ->> 'role';
  elsif tg_table_name = 'org_invitations' then
    v_entity_type := 'invitation';
    v_entity_id := (v_row ->> 'id')::uuid;
    v_entity_label := v_row ->> 'email';
  elsif tg_table_name = 'teams' then
    v_entity_type := 'team';
    v_entity_id := (v_row ->> 'id')::uuid;
    v_entity_label := v_row ->> 'name';
  elsif tg_table_name = 'team_members' then
    v_entity_type := 'team_member';
    v_entity_id := (v_row ->> 'user_id')::uuid;
    v_entity_label := v_row ->> 'team_id';
  else
    return null;
  end if;

  v_message := initcap(replace(v_entity_type, '_', ' ')) || ' ' || v_action ||
    case when v_entity_label is null or v_entity_label = '' then '' else ': ' || v_entity_label end;

  v_metadata := jsonb_strip_nulls(jsonb_build_object(
    'old_status', v_old_row ->> 'status',
    'new_status', v_row ->> 'status',
    'old_is_active', v_old_row ->> 'is_active',
    'new_is_active', v_row ->> 'is_active',
    'old_role', v_old_row ->> 'role',
    'new_role', v_row ->> 'role',
    'quantity_delta', v_row ->> 'quantity_delta',
    'reason', v_row ->> 'reason',
    'email', v_row ->> 'email'
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

drop trigger if exists trg_audit_materials on public.materials;
create trigger trg_audit_materials
after insert or update or delete on public.materials
for each row execute function public.write_audit_log();

drop trigger if exists trg_audit_locations on public.locations;
create trigger trg_audit_locations
after insert or update or delete on public.locations
for each row execute function public.write_audit_log();

drop trigger if exists trg_audit_suppliers on public.suppliers;
create trigger trg_audit_suppliers
after insert or update or delete on public.suppliers
for each row execute function public.write_audit_log();

drop trigger if exists trg_audit_stock_movements on public.stock_movements;
create trigger trg_audit_stock_movements
after insert or delete on public.stock_movements
for each row execute function public.write_audit_log();

drop trigger if exists trg_audit_purchase_orders on public.purchase_orders;
create trigger trg_audit_purchase_orders
after insert or update or delete on public.purchase_orders
for each row execute function public.write_audit_log();

drop trigger if exists trg_audit_org_users on public.org_users;
create trigger trg_audit_org_users
after insert or update or delete on public.org_users
for each row execute function public.write_audit_log();

drop trigger if exists trg_audit_org_invitations on public.org_invitations;
create trigger trg_audit_org_invitations
after insert or update or delete on public.org_invitations
for each row execute function public.write_audit_log();

drop trigger if exists trg_audit_teams on public.teams;
create trigger trg_audit_teams
after insert or update or delete on public.teams
for each row execute function public.write_audit_log();

drop trigger if exists trg_audit_team_members on public.team_members;
create trigger trg_audit_team_members
after insert or delete on public.team_members
for each row execute function public.write_audit_log();
