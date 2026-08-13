alter type public.billing_status add value if not exists 'incomplete_expired';
alter type public.billing_status add value if not exists 'paused';

alter table public.organization_billing
  add column if not exists stripe_subscription_item_id text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_subscription_schedule_id text,
  add column if not exists past_due_since timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists scheduled_plan public.billing_plan,
  add column if not exists scheduled_interval public.billing_interval,
  add column if not exists scheduled_effective_at timestamptz,
  add column if not exists last_stripe_event_created_at timestamptz;

create table public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  event_created_at timestamptz not null,
  processed_at timestamptz not null default timezone('utc', now())
);

alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from public, anon, authenticated;
revoke all on public.stripe_webhook_events from service_role;
grant select, insert, delete on public.stripe_webhook_events to service_role;

drop function if exists public.create_organization_with_owner(text, public.billing_plan);

create function public.create_organization_with_owner(
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
  if v_user_id is null then raise exception 'Authenticated user required'; end if;

  select o.* into v_org
  from public.org_users ou
  join public.organizations o on o.id = ou.org_id
  where ou.user_id = v_user_id and ou.role = 'owner'
  order by o.created_at asc limit 1;
  if v_org.id is not null then return v_org; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'Organization name is required'; end if;

  insert into public.organizations (name) values (trim(p_name)) returning * into v_org;
  insert into public.organization_billing (org_id, plan, status, billing_interval, trial_ends_at)
  values (
    v_org.id,
    case when p_start_trial then 'starter'::public.billing_plan else coalesce(p_plan, 'starter') end,
    case when p_start_trial then 'trialing'::public.billing_status else 'incomplete'::public.billing_status end,
    'monthly',
    case when p_start_trial then timezone('utc', now()) + interval '15 days' else null end
  );
  insert into public.org_users (org_id, user_id, role) values (v_org.id, v_user_id, 'owner');
  insert into public.teams (org_id, name, description, created_by, is_default)
  values (v_org.id, 'Default Team', 'Default team for organization', v_user_id, true)
  returning id into v_default_team_id;
  insert into public.team_members (team_id, user_id, created_by)
  values (v_default_team_id, v_user_id, v_user_id)
  on conflict (team_id, user_id) do nothing;
  return v_org;
end;
$$;

revoke all on function public.enforce_organization_plan_insert_limit() from public, anon, authenticated;

revoke all on function public.create_organization_with_owner(text, public.billing_plan, boolean) from public, anon;
grant execute on function public.create_organization_with_owner(text, public.billing_plan, boolean) to authenticated;

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
  select plan, status, trial_ends_at, past_due_since
  into v_plan, v_status, v_trial_ends_at, v_past_due_since
  from public.organization_billing where org_id = new.org_id;

  if v_status = 'trialing' and v_trial_ends_at >= timezone('utc', now()) then
    v_plan := 'starter';
  elsif v_status = 'past_due' and v_past_due_since + interval '7 days' >= timezone('utc', now()) then
    null;
  elsif v_status = 'incomplete' and tg_table_name = 'org_users'
    and not exists (select 1 from public.org_users where org_id = new.org_id) then
    v_plan := 'starter';
  elsif v_status = 'incomplete' and tg_table_name = 'teams'
    and not exists (select 1 from public.teams where org_id = new.org_id) then
    v_plan := 'starter';
  elsif v_status is distinct from 'active' then
    raise exception 'Workspace is read-only because its trial or subscription is not active';
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
    v_limit := 3; select count(*) into v_usage from public.locations where org_id = new.org_id;
  elsif tg_table_name = 'materials' then
    v_limit := case v_plan when 'starter' then 500 when 'operations' then 5000 else 25000 end;
    select count(*) into v_usage from public.materials where org_id = new.org_id;
  elsif tg_table_name = 'suppliers' then
    v_limit := case v_plan when 'starter' then 50 when 'operations' then 500 else 2500 end;
    select count(*) into v_usage from public.suppliers where org_id = new.org_id;
  elsif tg_table_name = 'purchase_orders' then
    v_limit := case v_plan when 'starter' then 50 when 'operations' then 500 else 2500 end;
    select count(*) into v_usage from public.purchase_orders where org_id = new.org_id and created_at >= date_trunc('month', timezone('utc', now()));
  elsif tg_table_name = 'stock_movements' then
    v_limit := case v_plan when 'starter' then 500 when 'operations' then 10000 else 50000 end;
    select count(*) into v_usage from public.stock_movements where org_id = new.org_id and created_at >= date_trunc('month', timezone('utc', now()));
  else return new;
  end if;

  if v_usage >= v_limit then raise exception '% plan limit reached for % (maximum %)', v_plan, tg_table_name, v_limit; end if;
  return new;
end;
$$;
