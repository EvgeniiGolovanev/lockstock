create type public.platform_admin_role as enum ('support', 'operator', 'admin');
create type public.billing_plan as enum ('starter', 'operations', 'business', 'enterprise');
create type public.billing_status as enum ('trialing', 'active', 'past_due', 'cancelled', 'unpaid', 'incomplete');
create type public.billing_interval as enum ('monthly', 'annual', 'custom');

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.platform_admin_role not null default 'support',
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id),
  disabled_at timestamptz
);

create table public.platform_access_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role public.platform_admin_role not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.organization_billing (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  plan public.billing_plan not null default 'starter',
  status public.billing_status not null default 'trialing',
  billing_interval public.billing_interval not null default 'monthly',
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamptz,
  current_period_end date,
  updated_at timestamptz not null default timezone('utc', now())
);

create index idx_platform_access_log_actor_created
  on public.platform_access_log (actor_user_id, created_at desc);

create index idx_platform_access_log_created
  on public.platform_access_log (created_at desc);

create index idx_organization_billing_plan_status
  on public.organization_billing (plan, status);

create trigger trg_organization_billing_updated_at
before update on public.organization_billing
for each row execute procedure public.set_updated_at();

alter table public.platform_admins enable row level security;
alter table public.platform_access_log enable row level security;
alter table public.organization_billing enable row level security;

grant select, insert, update on public.platform_admins to service_role;
grant select, insert on public.platform_access_log to service_role;
grant select, insert, update on public.organization_billing to service_role;
