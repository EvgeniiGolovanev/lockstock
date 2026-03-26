create or replace function public.reject_org_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invitation public.org_invitations;
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

  update public.org_invitations oi
  set status = 'revoked'
  where oi.id = v_invitation.id;

  return jsonb_build_object(
    'id', v_invitation.id,
    'org_id', v_invitation.org_id,
    'org_name', v_invitation.org_name,
    'status', 'revoked'
  );
end;
$$;

grant execute on function public.reject_org_invitation(uuid) to authenticated;
