create table public.public_rate_limits (
  scope text not null check (scope in ('contact', 'billing_checkout', 'billing_trial')),
  subject_hash text not null check (char_length(subject_hash) = 64),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (scope, subject_hash)
);

alter table public.public_rate_limits enable row level security;
revoke all on table public.public_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.public_rate_limits to service_role;

create or replace function public.consume_public_rate_limit(p_scope text, p_subject text)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window interval;
  v_max_requests integer;
  v_subject_hash text;
  v_now timestamptz := now();
  v_count integer;
  v_window_started_at timestamptz;
begin
  if p_scope = 'contact' then
    v_window := interval '15 minutes';
    v_max_requests := 5;
  elsif p_scope = 'billing_checkout' then
    v_window := interval '15 minutes';
    v_max_requests := 10;
  elsif p_scope = 'billing_trial' then
    v_window := interval '24 hours';
    v_max_requests := 3;
  else
    raise exception using errcode = '22023', message = 'Unsupported public rate-limit scope.';
  end if;

  if p_subject is null or char_length(p_subject) = 0 or char_length(p_subject) > 512 then
    raise exception using errcode = '22023', message = 'Invalid public rate-limit subject.';
  end if;

  v_subject_hash := encode(extensions.digest(p_subject, 'sha256'), 'hex');

  delete from public.public_rate_limits
  where (scope, subject_hash) in (
    select scope, subject_hash
    from public.public_rate_limits
    where updated_at < v_now - interval '48 hours'
    order by updated_at
    limit 100
    for update skip locked
  );

  insert into public.public_rate_limits (scope, subject_hash, window_started_at, request_count, updated_at)
  values (p_scope, v_subject_hash, v_now, 1, v_now)
  on conflict (scope, subject_hash) do update
  set window_started_at = case
        when public.public_rate_limits.window_started_at <= v_now - v_window then v_now
        else public.public_rate_limits.window_started_at
      end,
      request_count = case
        when public.public_rate_limits.window_started_at <= v_now - v_window then 1
        else public.public_rate_limits.request_count + 1
      end,
      updated_at = v_now
  returning request_count, window_started_at into v_count, v_window_started_at;

  return query select
    v_count <= v_max_requests,
    greatest(v_max_requests - v_count, 0),
    case when v_count <= v_max_requests then 0 else greatest(ceil(extract(epoch from (v_window_started_at + v_window - v_now)))::integer, 1) end;
end;
$$;

revoke all on function public.consume_public_rate_limit(text, text) from public, anon, authenticated;
grant execute on function public.consume_public_rate_limit(text, text) to service_role;
