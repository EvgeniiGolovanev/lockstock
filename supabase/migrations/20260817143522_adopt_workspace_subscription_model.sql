-- A subscription belongs to exactly one workspace. An account may own more
-- than one workspace, but each one has its own billing row and access state.
create or replace function public.create_organization_with_owner(
  p_name text,
  p_plan public.billing_plan default 'starter',
  p_start_trial boolean default true
)
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
    raise exception using errcode = '42501', message = 'Authenticated user required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('workspace-owner:' || v_user_id::text, 0));

  if p_start_trial and exists (
    select 1
    from public.workspace_trial_redemptions tr
    where tr.user_id = v_user_id
  ) then
    raise exception using errcode = '42501', message = 'Trial already redeemed';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Organization name is required';
  end if;

  insert into public.organizations (name) values (trim(p_name)) returning * into v_org;
  if p_start_trial then
    insert into public.workspace_trial_redemptions (user_id, org_id)
    values (v_user_id, v_org.id);
  end if;

  -- An active row exists only during this trusted bootstrap transaction. This
  -- authorizes the initial owner/default team without a user-controlled GUC.
  insert into public.organization_billing (org_id, plan, status, billing_interval, trial_ends_at)
  values (
    v_org.id,
    coalesce(p_plan, 'starter'),
    case when p_start_trial then 'trialing'::public.billing_status else 'active'::public.billing_status end,
    'monthly',
    case when p_start_trial then timezone('utc', now()) + interval '360 hours' else null end
  );
  insert into public.org_users (org_id, user_id, role) values (v_org.id, v_user_id, 'owner');
  insert into public.teams (org_id, name, description, created_by, is_default)
  values (v_org.id, 'Default Team', 'Default team for organization', v_user_id, true)
  returning id into v_default_team_id;
  insert into public.team_members (team_id, user_id, created_by)
  values (v_default_team_id, v_user_id, v_user_id);

  update public.organization_billing
  set status = case
        when p_start_trial then 'trialing'::public.billing_status
        else 'incomplete'::public.billing_status
      end,
      trial_ends_at = case when p_start_trial then now() + interval '360 hours' else null end
  where org_id = v_org.id;
  return v_org;
end;
$$;

revoke all on function public.create_organization_with_owner(text, public.billing_plan, boolean)
  from public, anon;
grant execute on function public.create_organization_with_owner(text, public.billing_plan, boolean)
  to authenticated;
