alter table public.organization_billing
  add column if not exists last_stripe_event_id text;

alter table public.stripe_webhook_events
  add column if not exists status text not null default 'processed',
  add column if not exists attempt_count integer not null default 1,
  add column if not exists claimed_at timestamptz not null default timezone('utc', now()),
  add column if not exists last_attempt_at timestamptz not null default timezone('utc', now()),
  add column if not exists failed_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists last_error_message text;

update public.stripe_webhook_events
set status = 'processed',
    attempt_count = greatest(coalesce(attempt_count, 1), 1),
    claimed_at = coalesce(claimed_at, processed_at, event_created_at, timezone('utc', now())),
    last_attempt_at = coalesce(last_attempt_at, processed_at, event_created_at, timezone('utc', now()))
where status is null or status = 'processing';

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
    event_id,
    event_type,
    event_created_at,
    status,
    attempt_count,
    claimed_at,
    last_attempt_at,
    processed_at,
    failed_at,
    last_error_code,
    last_error_message
  ) values (
    p_event_id,
    p_event_type,
    p_event_created_at,
    'processing',
    1,
    v_now,
    v_now,
    null,
    null,
    null,
    null
  )
  on conflict (event_id) do update
    set event_type = excluded.event_type,
        event_created_at = excluded.event_created_at,
        status = case
          when public.stripe_webhook_events.status = 'failed'
            or (
              public.stripe_webhook_events.status = 'processing'
              and public.stripe_webhook_events.claimed_at < v_now - p_stale_after
            )
            then 'processing'
          else public.stripe_webhook_events.status
        end,
        attempt_count = case
          when public.stripe_webhook_events.status = 'failed'
            or (
              public.stripe_webhook_events.status = 'processing'
              and public.stripe_webhook_events.claimed_at < v_now - p_stale_after
            )
            then public.stripe_webhook_events.attempt_count + 1
          else public.stripe_webhook_events.attempt_count
        end,
        claimed_at = case
          when public.stripe_webhook_events.status = 'failed'
            or (
              public.stripe_webhook_events.status = 'processing'
              and public.stripe_webhook_events.claimed_at < v_now - p_stale_after
            )
            then v_now
          else public.stripe_webhook_events.claimed_at
        end,
        last_attempt_at = v_now,
        processed_at = case
          when public.stripe_webhook_events.status = 'failed'
            or (
              public.stripe_webhook_events.status = 'processing'
              and public.stripe_webhook_events.claimed_at < v_now - p_stale_after
            )
            then null
          else public.stripe_webhook_events.processed_at
        end,
        failed_at = case
          when public.stripe_webhook_events.status = 'failed'
            or (
              public.stripe_webhook_events.status = 'processing'
              and public.stripe_webhook_events.claimed_at < v_now - p_stale_after
            )
            then null
          else public.stripe_webhook_events.failed_at
        end,
        last_error_code = case
          when public.stripe_webhook_events.status = 'failed'
            or (
              public.stripe_webhook_events.status = 'processing'
              and public.stripe_webhook_events.claimed_at < v_now - p_stale_after
            )
            then null
          else public.stripe_webhook_events.last_error_code
        end,
        last_error_message = case
          when public.stripe_webhook_events.status = 'failed'
            or (
              public.stripe_webhook_events.status = 'processing'
              and public.stripe_webhook_events.claimed_at < v_now - p_stale_after
            )
            then null
          else public.stripe_webhook_events.last_error_message
        end
    where public.stripe_webhook_events.status = 'failed'
       or (
        public.stripe_webhook_events.status = 'processing'
        and public.stripe_webhook_events.claimed_at < v_now - p_stale_after
       )
  returning * into v_row;

  if found then
    return query
      select
        v_row.event_id,
        v_row.event_type,
        v_row.event_created_at,
        v_row.status,
        v_row.attempt_count,
        v_row.claimed_at,
        v_row.processed_at,
        v_row.failed_at,
        v_row.last_error_code,
        v_row.last_error_message,
        true;
    return;
  end if;

  return query
    select
      event_id,
      event_type,
      event_created_at,
      status,
      attempt_count,
      claimed_at,
      processed_at,
      failed_at,
      last_error_code,
      last_error_message,
      false
    from public.stripe_webhook_events
    where event_id = p_event_id;
end;
$$;

create or replace function public.complete_stripe_webhook_event(p_event_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id text;
begin
  update public.stripe_webhook_events
  set status = 'processed',
      processed_at = timezone('utc', now()),
      last_attempt_at = timezone('utc', now()),
      failed_at = null,
      last_error_code = null,
      last_error_message = null
  where event_id = p_event_id
    and status = 'processing'
  returning event_id into v_event_id;

  if v_event_id is null then
    raise exception using errcode = '55000', message = 'Stripe webhook event was not claimed.';
  end if;
end;
$$;

create or replace function public.fail_stripe_webhook_event(
  p_event_id text,
  p_error_code text,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id text;
begin
  update public.stripe_webhook_events
  set status = 'failed',
      failed_at = timezone('utc', now()),
      last_attempt_at = timezone('utc', now()),
      last_error_code = p_error_code,
      last_error_message = p_error_message
  where event_id = p_event_id
    and status = 'processing'
  returning event_id into v_event_id;

  if v_event_id is null then
    raise exception using errcode = '55000', message = 'Stripe webhook event was not claimed.';
  end if;
end;
$$;

revoke all on function public.claim_stripe_webhook_event(text, text, timestamptz, interval) from public, anon, authenticated;
revoke all on function public.complete_stripe_webhook_event(text) from public, anon, authenticated;
revoke all on function public.fail_stripe_webhook_event(text, text, text) from public, anon, authenticated;
grant execute on function public.claim_stripe_webhook_event(text, text, timestamptz, interval) to service_role;
grant execute on function public.complete_stripe_webhook_event(text) to service_role;
grant execute on function public.fail_stripe_webhook_event(text, text, text) to service_role;
