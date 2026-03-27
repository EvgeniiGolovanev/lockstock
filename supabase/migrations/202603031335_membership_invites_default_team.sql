alter table public.teams
  add column if not exists is_default boolean not null default false;

create unique index if not exists uq_teams_single_default_per_org
  on public.teams (org_id)
  where is_default;

with first_team_per_org as (
  select distinct on (t.org_id) t.id, t.org_id
  from public.teams t
  order by t.org_id, t.created_at asc, t.id asc
)
update public.teams t
set is_default = true
from first_team_per_org ft
where t.id = ft.id
  and not exists (
    select 1
    from public.teams existing_default
    where existing_default.org_id = ft.org_id
      and existing_default.is_default
  );

insert into public.teams (org_id, name, description, created_by, is_default)
select
  o.id,
  'Default Team',
  'Default team for organization',
  owner_membership.user_id,
  true
from public.organizations o
left join lateral (
  select ou.user_id
  from public.org_users ou
  where ou.org_id = o.id
  order by
    case when ou.role = 'owner' then 0 else 1 end,
    ou.created_at asc
  limit 1
) owner_membership on true
where not exists (
  select 1
  from public.teams t
  where t.org_id = o.id
);

insert into public.team_members (team_id, user_id, created_by)
select
  t.id,
  ou.user_id,
  ou.user_id
from public.teams t
join public.org_users ou
  on ou.org_id = t.org_id
where t.is_default
on conflict (team_id, user_id) do nothing;

create table if not exists public.org_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.org_role not null default 'member',
  invited_by uuid not null,
  token_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired', 'superseded')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists uq_org_invitations_token_hash
  on public.org_invitations (token_hash);

create unique index if not exists uq_org_invitations_pending_org_email
  on public.org_invitations (org_id, lower(email))
  where status = 'pending';

create index if not exists idx_org_invitations_org_status_created
  on public.org_invitations (org_id, status, created_at desc);

drop trigger if exists trg_org_invitations_updated_at on public.org_invitations;
create trigger trg_org_invitations_updated_at
before update on public.org_invitations
for each row execute function public.set_updated_at();

create or replace function public.create_organization_with_owner(p_name text)
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
  if v_user_id is null then
    raise exception 'Authenticated user required';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Organization name is required';
  end if;

  insert into public.organizations (name)
  values (trim(p_name))
  returning * into v_org;

  insert into public.org_users (org_id, user_id, role)
  values (v_org.id, v_user_id, 'owner');

  insert into public.teams (org_id, name, description, created_by, is_default)
  values (v_org.id, 'Default Team', 'Default team for organization', v_user_id, true)
  returning id into v_default_team_id;

  insert into public.team_members (team_id, user_id, created_by)
  values (v_default_team_id, v_user_id, v_user_id)
  on conflict (team_id, user_id) do nothing;

  return v_org;
end;
$$;

grant execute on function public.create_organization_with_owner(text) to authenticated;

create or replace function public.is_org_owner(target_org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.org_users ou
    where ou.org_id = target_org_id
      and ou.user_id = auth.uid()
      and ou.role = 'owner'
  );
$$;

revoke all on function public.is_org_owner(uuid) from public;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to service_role;

alter table public.org_invitations enable row level security;

drop policy if exists org_owner_manage_org_invitations on public.org_invitations;
create policy org_owner_manage_org_invitations on public.org_invitations
for all
using (public.is_org_owner(org_id))
with check (public.is_org_owner(org_id));

drop policy if exists invitee_select_pending_org_invitation on public.org_invitations;
create policy invitee_select_pending_org_invitation on public.org_invitations
for select
using (
  status = 'pending'
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists invitee_accept_pending_org_invitation on public.org_invitations;
create policy invitee_accept_pending_org_invitation on public.org_invitations
for update
using (
  status = 'pending'
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
with check (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

grant select, insert, update, delete on public.org_invitations to authenticated;
grant select, insert, update, delete on public.org_invitations to service_role;
