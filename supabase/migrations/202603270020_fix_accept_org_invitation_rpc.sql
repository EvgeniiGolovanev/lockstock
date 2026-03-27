drop function if exists public.accept_org_invitation(uuid);

create or replace function public.accept_org_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invitation public.org_invitations;
  v_default_team_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authenticated user required';
  end if;

  select oi.*
  into v_invitation
  from public.org_invitations oi
  where oi.id = p_invitation_id
    and oi.status = 'pending'
    and oi.expires_at > timezone('utc', now())
    and lower(oi.email) = v_email;

  if not found then
    raise exception 'Pending invitation not found';
  end if;

  insert into public.org_users (org_id, user_id, role)
  values (v_invitation.org_id, v_user_id, 'member')
  on conflict (org_id, user_id) do update
  set role = excluded.role;

  select t.id
  into v_default_team_id
  from public.teams t
  where t.org_id = v_invitation.org_id
    and t.is_default
  limit 1;

  if v_default_team_id is null then
    raise exception 'Default team is not configured for this organization.';
  end if;

  insert into public.team_members (team_id, user_id, created_by)
  values (v_default_team_id, v_user_id, v_user_id)
  on conflict (team_id, user_id) do nothing;

  update public.org_invitations oi
  set status = 'accepted',
      accepted_at = timezone('utc', now()),
      accepted_by = v_user_id
  where oi.id = v_invitation.id;

  return jsonb_build_object(
    'id', v_invitation.id,
    'org_id', v_invitation.org_id,
    'org_name', v_invitation.org_name,
    'membership_role', 'member'
  );
end;
$$;

grant execute on function public.accept_org_invitation(uuid) to authenticated;
