drop policy if exists invitee_insert_org_users_from_pending_invitation on public.org_users;

create policy invitee_insert_org_users_from_pending_invitation on public.org_users
for insert
with check (
  user_id = auth.uid()
  and role = 'member'
  and exists (
    select 1
    from public.org_invitations oi
    where oi.org_id = org_users.org_id
      and oi.status = 'pending'
      and oi.expires_at > timezone('utc', now())
      and lower(oi.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);
