-- Enforce tenant role and billing state at the database boundary.

create or replace function public.workspace_has_write_access(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_billing billing
    where billing.org_id = target_org_id
      and (
        billing.status = 'active'
        or (
          billing.status = 'trialing'
          and billing.trial_ends_at is not null
          and billing.trial_ends_at >= now()
        )
        or (
          billing.status = 'past_due'
          and billing.past_due_since is not null
          and billing.past_due_since + interval '168 hours' >= now()
        )
      )
  );
$$;

revoke all on function public.workspace_has_write_access(uuid) from public, anon;
grant execute on function public.workspace_has_write_access(uuid) to authenticated, service_role;

create table if not exists public.workspace_trial_redemptions (
  user_id uuid primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  redeemed_at timestamptz not null default timezone('utc', now())
);

insert into public.workspace_trial_redemptions (user_id, org_id)
select distinct on (source.user_id)
  source.user_id,
  source.org_id
from (
  select
    ou.user_id,
    ou.org_id,
    ou.created_at as redeemed_at
  from public.org_users ou
  where ou.role = 'owner'

  union all

  select
    al.entity_id as user_id,
    al.org_id,
    al.created_at as redeemed_at
  from public.audit_log al
  where al.entity_type = 'member'
    and coalesce(al.metadata -> 'new_values' ->> 'role', al.metadata ->> 'new_role') = 'owner'
) as source
order by source.user_id, source.redeemed_at asc
on conflict (user_id) do nothing;

-- Earlier migrations revoked PUBLIC but local Supabase roles can retain
-- explicit grants. Remove both effective paths for every existing definer
-- helper before adding new client entry points below.
revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.is_org_role_at_least(uuid, public.org_role) from public, anon;
revoke all on function public.get_org_member_account_profiles(uuid) from public, anon;

create or replace function public.enforce_workspace_mutation_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_org_id uuid;
  v_new_org_id uuid;
  v_owner_count bigint;
begin
  if tg_table_name = 'org_users' then
    if tg_op <> 'DELETE' then v_new_org_id := new.org_id; end if;
    if tg_op <> 'INSERT' then v_old_org_id := old.org_id; end if;
    if v_old_org_id is not null then
      perform pg_advisory_xact_lock(hashtextextended('org-owner:' || v_old_org_id::text, 0));
    elsif v_new_org_id is not null then
      perform pg_advisory_xact_lock(hashtextextended('org-owner:' || v_new_org_id::text, 0));
    end if;
  end if;

  if auth.role() = 'service_role'
     or (auth.uid() is null and coalesce(current_setting('role', true), 'none') in ('none', 'postgres')) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_table_name = 'organizations' then
    if tg_op <> 'INSERT' then v_old_org_id := old.id; end if;
    if tg_op <> 'DELETE' then v_new_org_id := new.id; end if;
  elsif tg_table_name = 'team_members' then
    if tg_op <> 'INSERT' then
      select t.org_id into v_old_org_id from public.teams t where t.id = old.team_id;
    end if;
    if tg_op <> 'DELETE' then
      select t.org_id into v_new_org_id from public.teams t where t.id = new.team_id;
    end if;
  else
    if tg_op <> 'INSERT' then v_old_org_id := old.org_id; end if;
    if tg_op <> 'DELETE' then v_new_org_id := new.org_id; end if;
  end if;

  if tg_op = 'UPDATE'
     and v_old_org_id is distinct from v_new_org_id then
    raise exception using
      errcode = '42501',
      message = 'Organization id cannot be changed';
  end if;

  if tg_table_name = 'org_users' then
    if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
      raise exception using errcode = '42501', message = 'Membership user id cannot be changed';
    end if;
    if tg_op in ('UPDATE', 'DELETE')
       and old.user_id = auth.uid()
       and old.role = 'owner'
       and (tg_op = 'DELETE' or new.role is distinct from 'owner') then
      raise exception using errcode = '42501', message = 'An owner cannot remove or demote their own membership';
    end if;
    if tg_op in ('UPDATE', 'DELETE')
       and old.role = 'owner'
       and (tg_op = 'DELETE' or new.role is distinct from 'owner') then
      select count(*) into v_owner_count
      from public.org_users ou
      where ou.org_id = old.org_id
        and ou.role = 'owner'
        and ou.user_id <> old.user_id;
      if v_owner_count = 0 then
        raise exception using errcode = '42501', message = 'An organization must retain at least one owner';
      end if;
    end if;
  end if;

  if v_old_org_id is not null and not public.workspace_has_write_access(v_old_org_id) then
    raise exception using
      errcode = '42501',
      message = 'This workspace is read-only because its trial or subscription is not active.';
  end if;

  if v_new_org_id is not null
     and v_new_org_id is distinct from v_old_org_id
     and not public.workspace_has_write_access(v_new_org_id) then
    raise exception using
      errcode = '42501',
      message = 'This workspace is read-only because its trial or subscription is not active.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.enforce_workspace_mutation_access() from public, anon, authenticated;

create or replace function public.derive_workspace_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.role() = 'service_role'
     or (v_actor is null and coalesce(current_setting('role', true), 'none') in ('none', 'postgres')) then
    return new;
  end if;

  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authenticated user required';
  end if;

  if tg_table_name = 'org_invitations' then
    if tg_op = 'INSERT' then
      if new.status is distinct from 'pending'
         or new.accepted_at is not null
         or new.accepted_by is not null then
        raise exception using errcode = '42501', message = 'New invitations must be pending and unaccepted';
      end if;
      if new.invited_by is not null and new.invited_by is distinct from v_actor then
        raise exception using errcode = '42501', message = 'Actor id must match authenticated user';
      end if;
      new.invited_by := v_actor;
    else
      if new.org_id is distinct from old.org_id
         or new.org_name is distinct from old.org_name
         or new.email is distinct from old.email
         or new.role is distinct from old.role
         or new.invited_by is distinct from old.invited_by
         or new.token_hash is distinct from old.token_hash
         or new.expires_at is distinct from old.expires_at
         or new.created_at is distinct from old.created_at then
        raise exception using errcode = '42501', message = 'Invitation identity cannot be changed';
      end if;

      if new.status is not distinct from old.status then
        if new.accepted_at is distinct from old.accepted_at
           or new.accepted_by is distinct from old.accepted_by then
          raise exception using errcode = '42501', message = 'Invitation acceptance fields cannot be changed directly';
        end if;
      elsif old.status = 'pending' and new.status = 'superseded' then
        if new.accepted_at is distinct from old.accepted_at
           or new.accepted_by is distinct from old.accepted_by then
          raise exception using errcode = '42501', message = 'Superseded invitations cannot have acceptance fields';
        end if;
      elsif old.status = 'pending'
            and new.status = 'accepted'
            and lower(old.email) = v_email
            and new.accepted_by = v_actor
            and new.accepted_at is not null then
        null;
      elsif old.status = 'pending'
            and new.status = 'revoked'
            and lower(old.email) = v_email
            and new.accepted_at is not distinct from old.accepted_at
            and new.accepted_by is not distinct from old.accepted_by then
        null;
      else
        raise exception using errcode = '42501', message = 'Invitation status transition is not allowed';
      end if;
    end if;
  else
    if tg_op = 'INSERT' then
      if new.created_by is not null and new.created_by is distinct from v_actor then
        raise exception using errcode = '42501', message = 'Actor id must match authenticated user';
      end if;
      new.created_by := v_actor;
    else
      -- PostgREST upsert sends every supplied column through the UPDATE path.
      -- Preserve the original immutable actor instead of rejecting a safe
      -- conflict update from a different manager.
      new.created_by := old.created_by;
    end if;
  end if;

  if tg_table_name in ('purchase_orders', 'stock_movements') then
    if tg_op = 'INSERT' then
      new.created_at := now();
    elsif new.created_at is distinct from old.created_at then
      raise exception using errcode = '42501', message = 'Creation timestamp cannot be changed';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.derive_workspace_actor() from public, anon, authenticated;

-- Keep the plan matrix aligned with lib/billing/entitlements.ts and serialize
-- every finite-limit decision for an organization in the current transaction.
create or replace function public.enforce_organization_plan_insert_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.billing_plan := 'starter';
  v_status public.billing_status;
  v_trial_ends_at timestamptz;
  v_past_due_since timestamptz;
  v_limit bigint;
  v_usage bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.org_id::text, 0));

  select billing.plan, billing.status, billing.trial_ends_at, billing.past_due_since
  into v_plan, v_status, v_trial_ends_at, v_past_due_since
  from public.organization_billing billing
  where billing.org_id = new.org_id;

  if v_status = 'trialing' and v_trial_ends_at is not null and v_trial_ends_at >= now() then
    v_plan := 'starter';
  elsif v_status = 'past_due' and v_past_due_since is not null
        and v_past_due_since + interval '168 hours' >= now() then
    null;
  elsif v_status is distinct from 'active' then
    raise exception using
      errcode = '42501',
      message = 'This workspace is read-only because its trial or subscription is not active.';
  end if;

  if auth.role() = 'authenticated' and tg_table_name in ('purchase_orders', 'stock_movements') then
    new.created_at := now();
  end if;

  -- BEFORE INSERT triggers run before ON CONFLICT resolution. Existing rows
  -- do not consume another entitlement slot, so allow the unique conflict to
  -- proceed to its UPDATE/DO NOTHING path while still holding the org lock.
  if tg_table_name = 'org_users' then
    if exists (select 1 from public.org_users where org_id = new.org_id and user_id = new.user_id) then
      return new;
    end if;
  elsif tg_table_name = 'teams' then
    if exists (select 1 from public.teams where org_id = new.org_id and name = new.name) then
      return new;
    end if;
  elsif tg_table_name = 'locations' then
    if exists (select 1 from public.locations where org_id = new.org_id and code = new.code) then
      return new;
    end if;
  elsif tg_table_name = 'materials' then
    if exists (select 1 from public.materials where org_id = new.org_id and sku = new.sku) then
      return new;
    end if;
  elsif tg_table_name = 'suppliers' then
    if exists (select 1 from public.suppliers where org_id = new.org_id and name = new.name) then
      return new;
    end if;
  elsif tg_table_name = 'purchase_orders' then
    if exists (select 1 from public.purchase_orders where org_id = new.org_id and po_number = new.po_number) then
      return new;
    end if;
  elsif tg_table_name = 'stock_movements' then
    if exists (select 1 from public.stock_movements where id = new.id) then
      return new;
    end if;
  end if;

  if v_plan = 'enterprise' then return new; end if;

  if tg_table_name = 'org_users' then
    v_limit := case v_plan when 'starter' then 3 when 'operations' then 8 else 20 end;
    select count(*) into v_usage from public.org_users where org_id = new.org_id;
  elsif tg_table_name = 'teams' then
    v_limit := case v_plan when 'starter' then 1 when 'operations' then 5 else 20 end;
    select count(*) into v_usage from public.teams where org_id = new.org_id;
  elsif tg_table_name = 'locations' then
    if v_plan <> 'starter' then return new; end if;
    v_limit := 3;
    select count(*) into v_usage from public.locations where org_id = new.org_id;
  elsif tg_table_name = 'materials' then
    v_limit := case v_plan when 'starter' then 500 when 'operations' then 5000 else 25000 end;
    select count(*) into v_usage from public.materials where org_id = new.org_id;
  elsif tg_table_name = 'suppliers' then
    v_limit := case v_plan when 'starter' then 50 when 'operations' then 500 else 2500 end;
    select count(*) into v_usage from public.suppliers where org_id = new.org_id;
  elsif tg_table_name = 'purchase_orders' then
    v_limit := case v_plan when 'starter' then 50 when 'operations' then 500 else 2500 end;
    select count(*) into v_usage
    from public.purchase_orders
    where org_id = new.org_id
      and created_at >= (date_trunc('month', now() at time zone 'UTC') at time zone 'UTC')
      and created_at < ((date_trunc('month', now() at time zone 'UTC') + interval '1 month') at time zone 'UTC');
  elsif tg_table_name = 'stock_movements' then
    v_limit := case v_plan when 'starter' then 500 when 'operations' then 10000 else 50000 end;
    select count(*) into v_usage
    from public.stock_movements
    where org_id = new.org_id
      and created_at >= (date_trunc('month', now() at time zone 'UTC') at time zone 'UTC')
      and created_at < ((date_trunc('month', now() at time zone 'UTC') + interval '1 month') at time zone 'UTC');
  else
    return new;
  end if;

  if v_usage >= v_limit then
    raise exception using
      errcode = '23514',
      message = format('%s plan limit reached for %s (maximum %s)', v_plan, tg_table_name, v_limit);
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_organization_plan_insert_limit() from public, anon, authenticated;

-- Make the database API usable for the same direct mutations already allowed
-- by RLS. RLS plus the guard triggers below remain authoritative.
revoke insert, update, delete on
  public.organizations,
  public.org_users,
  public.teams,
  public.team_members,
  public.locations,
  public.materials,
  public.suppliers,
  public.supplier_materials,
  public.inventory_balances,
  public.stock_movements,
  public.purchase_orders,
  public.po_lines,
  public.org_invitations
from anon;
revoke truncate, references, trigger, maintain on all tables in schema public from anon, authenticated;
revoke insert, update, delete on public.inventory_balances, public.stock_movements from authenticated;

grant select, update on public.organizations to authenticated;
revoke delete on public.organizations from authenticated;
grant select, insert, update, delete on public.org_users to authenticated;
grant select, insert, update, delete on public.teams to authenticated;
grant select, insert, delete on public.team_members to authenticated;
grant select, insert, update, delete on public.locations to authenticated;
grant select, insert, update, delete on public.materials to authenticated;
grant select, insert, update, delete on public.suppliers to authenticated;
grant select, insert, update, delete on public.supplier_materials to authenticated;
grant select on public.inventory_balances, public.stock_movements to authenticated;
grant select, insert, update on public.purchase_orders to authenticated;
revoke delete on public.purchase_orders from authenticated;
grant select, insert, update, delete on public.po_lines to authenticated;
revoke update(status, sent_at, received_at) on public.purchase_orders from authenticated;
revoke update(quantity_received, material_id, purchase_order_id) on public.po_lines from authenticated;

-- Stock movements are immutable accounting history. Parent cleanup must not
-- silently erase current-month usage and reopen the movement quota.
alter table public.stock_movements drop constraint if exists fk_stock_movements_material_org;
alter table public.stock_movements
  add constraint fk_stock_movements_material_org
  foreign key (material_id, org_id) references public.materials (id, org_id) on delete restrict;
alter table public.stock_movements drop constraint if exists fk_stock_movements_location_org;
alter table public.stock_movements
  add constraint fk_stock_movements_location_org
  foreign key (location_id, org_id) references public.locations (id, org_id) on delete restrict;

drop policy if exists invitee_accept_pending_org_invitation on public.org_invitations;
drop policy if exists invitee_insert_org_users_from_pending_invitation on public.org_users;
drop policy if exists org_access_purchase_orders on public.purchase_orders;
drop policy if exists org_select_purchase_orders on public.purchase_orders;
drop policy if exists org_manager_insert_purchase_orders on public.purchase_orders;
drop policy if exists org_manager_update_purchase_orders on public.purchase_orders;
drop policy if exists org_manager_delete_purchase_orders on public.purchase_orders;
create policy org_select_purchase_orders on public.purchase_orders
for select using (public.is_org_member(org_id));
create policy org_manager_insert_purchase_orders on public.purchase_orders
for insert with check (
  public.is_org_role_at_least(org_id, 'manager')
  and status = 'draft'
  and sent_at is null
  and received_at is null
);
create policy org_manager_update_purchase_orders on public.purchase_orders
for update using (public.is_org_role_at_least(org_id, 'manager')) with check (public.is_org_role_at_least(org_id, 'manager'));
create policy org_manager_delete_purchase_orders on public.purchase_orders
for delete using (public.is_org_role_at_least(org_id, 'manager'));

drop policy if exists org_access_po_lines on public.po_lines;
drop policy if exists org_select_po_lines on public.po_lines;
drop policy if exists org_manager_insert_po_lines on public.po_lines;
drop policy if exists org_manager_update_po_lines on public.po_lines;
drop policy if exists org_manager_delete_po_lines on public.po_lines;
create policy org_select_po_lines on public.po_lines
for select using (
  exists (
    select 1
    from public.purchase_orders po
    where po.id = po_lines.purchase_order_id
      and public.is_org_member(po.org_id)
  )
);
create policy org_manager_insert_po_lines on public.po_lines
for insert with check (
  quantity_received = 0
  and exists (
    select 1
    from public.purchase_orders po
    where po.id = po_lines.purchase_order_id
      and public.is_org_role_at_least(po.org_id, 'manager')
  )
);
create policy org_manager_update_po_lines on public.po_lines
for update using (
  exists (
    select 1
    from public.purchase_orders po
    where po.id = po_lines.purchase_order_id
      and public.is_org_role_at_least(po.org_id, 'manager')
  )
) with check (
  exists (
    select 1
    from public.purchase_orders po
    where po.id = po_lines.purchase_order_id
      and public.is_org_role_at_least(po.org_id, 'manager')
  )
);
create policy org_manager_delete_po_lines on public.po_lines
for delete using (
  exists (
    select 1
    from public.purchase_orders po
    where po.id = po_lines.purchase_order_id
      and public.is_org_role_at_least(po.org_id, 'manager')
  )
);

alter table public.org_invitations
  drop constraint if exists org_invitations_role_not_owner;
alter table public.org_invitations
  add constraint org_invitations_role_not_owner check (role <> 'owner') not valid;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'org_users', 'teams', 'team_members', 'locations', 'materials', 'suppliers',
    'supplier_materials', 'inventory_balances', 'stock_movements',
    'purchase_orders', 'po_lines', 'org_invitations'
  ] loop
    execute format('drop trigger if exists trg_workspace_write_guard on public.%I', v_table);
    execute format(
      'create trigger trg_workspace_write_guard before insert or update or delete on public.%I '
      'for each row execute function public.enforce_workspace_mutation_access()',
      v_table
    );
  end loop;
end;
$$;

drop trigger if exists trg_workspace_write_guard on public.organizations;
create trigger trg_workspace_write_guard
before update or delete on public.organizations
for each row execute function public.enforce_workspace_mutation_access();

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'teams', 'team_members', 'materials', 'suppliers', 'purchase_orders', 'stock_movements'
  ] loop
    execute format('drop trigger if exists trg_workspace_actor on public.%I', v_table);
    execute format(
      'create trigger trg_workspace_actor before insert or update on public.%I '
      'for each row execute function public.derive_workspace_actor()',
      v_table
    );
  end loop;
end;
$$;

drop trigger if exists trg_workspace_actor on public.org_invitations;
create trigger trg_workspace_actor
before insert or update on public.org_invitations
for each row execute function public.derive_workspace_actor();

-- Internal stock primitive. It is deliberately SECURITY INVOKER and has no
-- client EXECUTE grant. Public RPCs validate the requested business operation,
-- derive the actor, then call this primitive as their definer owner.
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
  v_new_balance numeric(14, 3);
  v_movement_id uuid := gen_random_uuid();
begin
  perform pg_advisory_xact_lock(hashtextextended('stock-org:' || p_org_id::text, 0));

  if p_actor is null then
    raise exception using errcode = '42501', message = 'Authenticated user required';
  end if;
  if p_quantity_delta is null
     or p_quantity_delta::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = '22003', message = 'quantity_delta must be finite';
  end if;
  if p_quantity_delta = 0 then raise exception 'quantity_delta cannot be zero'; end if;

  perform 1
  from public.materials
  where id = p_material_id
    and org_id = p_org_id
    and is_active;
  if not found then raise exception 'Material does not exist in this organization'; end if;
  perform 1
  from public.locations
  where id = p_location_id
    and org_id = p_org_id
    and is_active;
  if not found then raise exception 'Location does not exist in this organization'; end if;

  insert into public.inventory_balances (org_id, material_id, location_id, quantity)
  values (p_org_id, p_material_id, p_location_id, p_quantity_delta)
  on conflict (org_id, material_id, location_id)
  do update set
    quantity = public.inventory_balances.quantity + excluded.quantity,
    updated_at = now()
  returning quantity into v_new_balance;

  if v_new_balance < 0 then
    raise exception 'Insufficient stock for this movement';
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

revoke all on function public.apply_stock_movement_internal(
  uuid, uuid, uuid, numeric, public.movement_reason, text, text, uuid, uuid
) from public, anon, authenticated;

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
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authenticated user required';
  end if;
  if p_created_by is not null and p_created_by is distinct from v_actor then
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
  if p_reason not in ('adjustment', 'consumption') then
    raise exception using errcode = '42501', message = 'Movement reason is reserved for a guarded operation';
  end if;
  if p_reason = 'consumption' and p_quantity_delta >= 0 then
    raise exception using errcode = '22023', message = 'Consumption quantity must be less than zero';
  end if;

  return public.apply_stock_movement_internal(
    p_org_id, p_material_id, p_location_id, p_quantity_delta, p_reason,
    p_note, p_reference_type, p_reference_id, v_actor
  );
end;
$$;

revoke all on function public.create_stock_movement(
  uuid, uuid, uuid, numeric, public.movement_reason, text, text, uuid, uuid
) from public, anon;
grant execute on function public.create_stock_movement(
  uuid, uuid, uuid, numeric, public.movement_reason, text, text, uuid, uuid
) to authenticated;

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
  v_actor uuid := auth.uid();
  v_out_movement_id uuid;
  v_in_movement_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authenticated user required';
  end if;
  if p_created_by is not null and p_created_by is distinct from v_actor then
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
  if p_quantity is null or p_quantity::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = '22003', message = 'quantity must be finite';
  end if;
  if p_quantity <= 0 then raise exception 'quantity must be greater than zero'; end if;
  if p_from_location_id = p_to_location_id then raise exception 'Transfer locations must be different'; end if;

  v_out_movement_id := public.apply_stock_movement_internal(
    p_org_id, p_material_id, p_from_location_id, p_quantity * -1, 'transfer_out',
    p_note, 'stock_transfer', null, v_actor
  );
  v_in_movement_id := public.apply_stock_movement_internal(
    p_org_id, p_material_id, p_to_location_id, p_quantity, 'transfer_in',
    p_note, 'stock_transfer', null, v_actor
  );
  return array[v_out_movement_id, v_in_movement_id];
end;
$$;

revoke all on function public.create_stock_transfer(uuid, uuid, uuid, uuid, numeric, text, uuid)
  from public, anon;
grant execute on function public.create_stock_transfer(uuid, uuid, uuid, uuid, numeric, text, uuid)
  to authenticated;

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

revoke all on function public.transition_purchase_order_status(uuid, uuid, public.po_status)
  from public, anon;
grant execute on function public.transition_purchase_order_status(uuid, uuid, public.po_status)
  to authenticated;

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

revoke all on function public.receive_purchase_order(uuid, uuid, uuid, jsonb) from public, anon;
grant execute on function public.receive_purchase_order(uuid, uuid, uuid, jsonb) to authenticated;

-- Invitation recipients may only transition immutable invitations through the
-- guarded RPCs; no direct invitee UPDATE policy remains.
create or replace function public.accept_org_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invitation public.org_invitations;
  v_default_team_id uuid;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Authenticated user required'; end if;

  select oi.* into v_invitation
  from public.org_invitations oi
  where oi.id = p_invitation_id
    and oi.status = 'pending'
    and oi.expires_at > now()
    and lower(oi.email) = v_email
  for update;
  if not found then raise exception 'Pending invitation not found'; end if;
  if v_invitation.role = 'owner' then raise exception using errcode = '42501', message = 'Owner invitations are not allowed'; end if;
  if not public.workspace_has_write_access(v_invitation.org_id) then
    raise exception using
      errcode = '42501',
      message = 'This workspace is read-only because its trial or subscription is not active.';
  end if;

  insert into public.org_users (org_id, user_id, role)
  values (v_invitation.org_id, v_user_id, v_invitation.role)
  on conflict (org_id, user_id) do update set role = excluded.role;

  select t.id into v_default_team_id
  from public.teams t
  where t.org_id = v_invitation.org_id and t.is_default
  limit 1;
  if v_default_team_id is null then raise exception 'Default team is not configured for this organization.'; end if;

  insert into public.team_members (team_id, user_id, created_by)
  values (v_default_team_id, v_user_id, v_user_id)
  on conflict (team_id, user_id) do nothing;

  update public.org_invitations
  set status = 'accepted', accepted_at = now(), accepted_by = v_user_id
  where id = v_invitation.id;

  return jsonb_build_object(
    'id', v_invitation.id,
    'org_id', v_invitation.org_id,
    'org_name', v_invitation.org_name,
    'membership_role', v_invitation.role
  );
end;
$$;

revoke all on function public.accept_org_invitation(uuid) from public, anon;
grant execute on function public.accept_org_invitation(uuid) to authenticated;

create or replace function public.reject_org_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invitation public.org_invitations;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Authenticated user required'; end if;

  select oi.* into v_invitation
  from public.org_invitations oi
  where oi.id = p_invitation_id
    and oi.status = 'pending'
    and oi.expires_at > now()
    and lower(oi.email) = v_email
  for update;
  if not found then raise exception 'Pending invitation not found'; end if;
  if not public.workspace_has_write_access(v_invitation.org_id) then
    raise exception using
      errcode = '42501',
      message = 'This workspace is read-only because its trial or subscription is not active.';
  end if;

  update public.org_invitations set status = 'revoked' where id = v_invitation.id;
  return jsonb_build_object(
    'id', v_invitation.id,
    'org_id', v_invitation.org_id,
    'org_name', v_invitation.org_name,
    'status', 'revoked'
  );
end;
$$;

revoke all on function public.reject_org_invitation(uuid) from public, anon;
grant execute on function public.reject_org_invitation(uuid) to authenticated;

-- Trigger functions are not client RPCs; remove their inherited PUBLIC ACLs.
revoke all on function public.write_audit_log() from public, anon, authenticated;

-- Preserve workspace bootstrap while keeping incomplete workspaces read-only
-- after the single trusted transaction completes.
create or replace function public.create_organization_with_owner(
  p_name text,
  p_plan public.billing_plan default 'starter',
  p_start_trial boolean default true
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org public.organizations;
  v_default_team_id uuid;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Authenticated user required'; end if;

  perform pg_advisory_xact_lock(hashtextextended('workspace-owner:' || v_user_id::text, 0));

  select o.* into v_org
  from public.org_users ou
  join public.organizations o on o.id = ou.org_id
  where ou.user_id = v_user_id and ou.role = 'owner'
  order by o.created_at asc limit 1;
  if v_org.id is not null then return v_org; end if;
  if p_start_trial and exists (
    select 1
    from public.workspace_trial_redemptions tr
    where tr.user_id = v_user_id
  ) then
    raise exception using errcode = '42501', message = 'Trial already redeemed';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'Organization name is required'; end if;

  insert into public.organizations (name) values (trim(p_name)) returning * into v_org;
  if p_start_trial then
    insert into public.workspace_trial_redemptions (user_id, org_id)
    values (v_user_id, v_org.id);
  end if;

  -- Use an active row only inside this uncommitted bootstrap transaction.
  -- This lets normal write guards authorize the initial owner/default team
  -- without trusting an attacker-settable custom GUC.
  insert into public.organization_billing (org_id, plan, status, billing_interval, trial_ends_at)
  values (
    v_org.id,
    coalesce(p_plan, 'starter'),
    'active',
    'monthly',
    null
  );
  insert into public.org_users (org_id, user_id, role) values (v_org.id, v_user_id, 'owner');
  insert into public.teams (org_id, name, description, created_by, is_default)
  values (v_org.id, 'Default Team', 'Default team for organization', v_user_id, true)
  returning id into v_default_team_id;
  insert into public.team_members (team_id, user_id, created_by)
  values (v_default_team_id, v_user_id, v_user_id);

  update public.organization_billing
  set status = case
        when p_start_trial then 'trialing'::public.billing_status
        else 'incomplete'::public.billing_status
      end,
      trial_ends_at = case when p_start_trial then now() + interval '360 hours' else null end
  where org_id = v_org.id;
  return v_org;
end;
$$;

revoke all on function public.create_organization_with_owner(text, public.billing_plan, boolean)
  from public, anon;
grant execute on function public.create_organization_with_owner(text, public.billing_plan, boolean)
  to authenticated;
