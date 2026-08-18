-- The redemption record is the account-wide trial ledger. Activation must write
-- it in the same transaction as the workspace billing state.
create or replace function public.start_workspace_trial(p_org_id uuid)
returns table (org_id uuid, trial_ends_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trial_ends_at timestamptz := timezone('utc', now()) + interval '360 hours';
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authenticated user required';
  end if;
  if not exists (
    select 1 from public.org_users
    where org_id = p_org_id and user_id = v_user_id and role = 'owner'
  ) then
    raise exception using errcode = '42501', message = 'This action requires owner role.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('workspace-trial:' || v_user_id::text, 0));
  if exists (select 1 from public.workspace_trial_redemptions where user_id = v_user_id) then
    raise exception using errcode = '42501', message = 'Trial already redeemed';
  end if;

  update public.organization_billing
  set status = 'trialing', billing_interval = 'monthly', trial_ends_at = v_trial_ends_at,
      past_due_since = null, scheduled_plan = null, scheduled_interval = null,
      scheduled_effective_at = null
  where organization_billing.org_id = p_org_id
    and stripe_subscription_id is null
    and status <> 'active'
    and trial_ends_at is null;
  if not found then
    raise exception using errcode = '23514', message = 'This workspace cannot start a trial';
  end if;

  insert into public.workspace_trial_redemptions (user_id, org_id)
  values (v_user_id, p_org_id);

  return query select p_org_id, v_trial_ends_at;
end;
$$;

revoke all on function public.start_workspace_trial(uuid) from public, anon;
grant execute on function public.start_workspace_trial(uuid) to authenticated;
