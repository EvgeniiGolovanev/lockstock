-- Keep inventory constraints deterministic: calculate and validate the final
-- balance before writing it, so a valid transfer never attempts a negative
-- intermediate row and invalid material/location input returns an access error.
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

revoke all on function public.apply_stock_movement_internal(
  uuid, uuid, uuid, numeric, public.movement_reason, text, text, uuid, uuid
) from public, anon, authenticated;

-- Output-column names of a RETURNS TABLE function are PL/pgSQL variables.
-- Use the primary-key constraint and a table alias to avoid ambiguous names.
alter table public.stripe_webhook_events
  alter column processed_at drop not null;

create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_event_created_at timestamptz,
  p_stale_after interval default interval '5 minutes'
)
returns table (
  event_id text,
  event_type text,
  event_created_at timestamptz,
  status text,
  attempt_count integer,
  claimed_at timestamptz,
  processed_at timestamptz,
  failed_at timestamptz,
  last_error_code text,
  last_error_message text,
  claimed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_row public.stripe_webhook_events%rowtype;
begin
  insert into public.stripe_webhook_events (
    event_id, event_type, event_created_at, status, attempt_count, claimed_at,
    last_attempt_at, processed_at, failed_at, last_error_code, last_error_message
  ) values (
    p_event_id, p_event_type, p_event_created_at, 'processing', 1, v_now,
    v_now, null, null, null, null
  )
  on conflict on constraint stripe_webhook_events_pkey do update
    set event_type = excluded.event_type,
        event_created_at = excluded.event_created_at,
        status = case
          when public.stripe_webhook_events.status = 'failed'
            or (public.stripe_webhook_events.status = 'processing'
              and public.stripe_webhook_events.claimed_at < v_now - p_stale_after)
            then 'processing'
          else public.stripe_webhook_events.status
        end,
        attempt_count = case
          when public.stripe_webhook_events.status = 'failed'
            or (public.stripe_webhook_events.status = 'processing'
              and public.stripe_webhook_events.claimed_at < v_now - p_stale_after)
            then public.stripe_webhook_events.attempt_count + 1
          else public.stripe_webhook_events.attempt_count
        end,
        claimed_at = case
          when public.stripe_webhook_events.status = 'failed'
            or (public.stripe_webhook_events.status = 'processing'
              and public.stripe_webhook_events.claimed_at < v_now - p_stale_after)
            then v_now
          else public.stripe_webhook_events.claimed_at
        end,
        last_attempt_at = v_now,
        processed_at = case
          when public.stripe_webhook_events.status = 'failed'
            or (public.stripe_webhook_events.status = 'processing'
              and public.stripe_webhook_events.claimed_at < v_now - p_stale_after)
            then null else public.stripe_webhook_events.processed_at
        end,
        failed_at = case
          when public.stripe_webhook_events.status = 'failed'
            or (public.stripe_webhook_events.status = 'processing'
              and public.stripe_webhook_events.claimed_at < v_now - p_stale_after)
            then null else public.stripe_webhook_events.failed_at
        end,
        last_error_code = case
          when public.stripe_webhook_events.status = 'failed'
            or (public.stripe_webhook_events.status = 'processing'
              and public.stripe_webhook_events.claimed_at < v_now - p_stale_after)
            then null else public.stripe_webhook_events.last_error_code
        end,
        last_error_message = case
          when public.stripe_webhook_events.status = 'failed'
            or (public.stripe_webhook_events.status = 'processing'
              and public.stripe_webhook_events.claimed_at < v_now - p_stale_after)
            then null else public.stripe_webhook_events.last_error_message
        end
    where public.stripe_webhook_events.status = 'failed'
       or (public.stripe_webhook_events.status = 'processing'
         and public.stripe_webhook_events.claimed_at < v_now - p_stale_after)
  returning * into v_row;

  if found then
    return query select
      v_row.event_id, v_row.event_type, v_row.event_created_at, v_row.status,
      v_row.attempt_count, v_row.claimed_at, v_row.processed_at, v_row.failed_at,
      v_row.last_error_code, v_row.last_error_message, true;
    return;
  end if;

  return query
    select ledger.event_id, ledger.event_type, ledger.event_created_at,
      ledger.status, ledger.attempt_count, ledger.claimed_at, ledger.processed_at,
      ledger.failed_at, ledger.last_error_code, ledger.last_error_message, false
    from public.stripe_webhook_events as ledger
    where ledger.event_id = p_event_id;
end;
$$;
