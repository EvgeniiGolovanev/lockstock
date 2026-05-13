create or replace function public.get_org_member_account_profiles(target_org_id uuid)
returns table (
  user_id uuid,
  email text,
  full_name text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    au.id as user_id,
    au.email::text as email,
    nullif(trim(au.raw_user_meta_data ->> 'full_name'), '') as full_name
  from public.org_users ou
  join auth.users au on au.id = ou.user_id
  where ou.org_id = target_org_id
    and public.is_org_role_at_least(target_org_id, 'manager');
$$;

revoke all on function public.get_org_member_account_profiles(uuid) from public;
grant execute on function public.get_org_member_account_profiles(uuid) to authenticated;
grant execute on function public.get_org_member_account_profiles(uuid) to service_role;
