create or replace function public.create_organization_with_owner(p_name text)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org public.organizations;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Organization name is required';
  end if;

  insert into public.organizations (name)
  values (trim(p_name))
  returning * into v_org;

  insert into public.org_users (org_id, user_id, role)
  values (v_org.id, v_user_id, 'owner');

  return v_org;
end;
$$;

grant execute on function public.create_organization_with_owner(text) to authenticated;
