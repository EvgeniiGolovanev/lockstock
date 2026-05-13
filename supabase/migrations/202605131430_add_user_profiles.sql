create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_select_self_or_org_manager on public.user_profiles;
drop policy if exists user_profiles_insert_self on public.user_profiles;
drop policy if exists user_profiles_update_self on public.user_profiles;

create policy user_profiles_select_self_or_org_manager on public.user_profiles
for select using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.org_users target_membership
    join public.org_users caller_membership
      on caller_membership.org_id = target_membership.org_id
    where target_membership.user_id = user_profiles.user_id
      and caller_membership.user_id = auth.uid()
      and (
        case caller_membership.role
          when 'owner' then 3
          when 'manager' then 2
          when 'member' then 1
          when 'viewer' then 0
        end
      ) >= 2
  )
);

create policy user_profiles_insert_self on public.user_profiles
for insert with check (user_id = auth.uid());

create policy user_profiles_update_self on public.user_profiles
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.user_profiles to authenticated;
