create or replace function public.remove_org_member_with_team_memberships(
  p_org_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target_role text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authenticated user required';
  end if;
  if p_target_user_id is null then
    raise exception 'Target user is required';
  end if;
  if p_target_user_id <> v_actor and not public.is_org_role_at_least(p_org_id, 'owner') then
    raise exception using errcode = '42501', message = 'This action requires owner role';
  end if;
  if not public.workspace_has_write_access(p_org_id) then
    raise exception using
      errcode = '42501',
      message = 'This workspace is read-only because its trial or subscription is not active.';
  end if;

  select role
  into v_target_role
  from public.org_users
  where org_id = p_org_id
    and user_id = p_target_user_id
  for update;

  if not found then
    raise exception 'Organization member not found.';
  end if;

  if v_target_role = 'owner' then
    raise exception 'Cannot remove an owner from organization.';
  end if;

  delete from public.team_members
  where user_id = p_target_user_id
    and team_id in (
      select id
      from public.teams
      where org_id = p_org_id
    );

  delete from public.org_users
  where org_id = p_org_id
    and user_id = p_target_user_id;

  return jsonb_build_object('user_id', p_target_user_id, 'removed', true);
end;
$$;

revoke all on function public.remove_org_member_with_team_memberships(uuid, uuid) from public, anon;
grant execute on function public.remove_org_member_with_team_memberships(uuid, uuid) to authenticated;

