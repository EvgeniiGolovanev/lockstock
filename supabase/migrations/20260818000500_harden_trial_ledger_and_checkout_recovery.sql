-- Trial redemption is account history, not workspace state. Preserve it when a
-- workspace is deleted so deleting an old trial cannot mint another one.
create table if not exists public.workspace_trial_redemptions (
  user_id uuid primary key,
  org_id uuid,
  redeemed_at timestamptz not null default timezone('utc', now())
);
alter table public.workspace_trial_redemptions
  alter column org_id drop not null;
alter table public.workspace_trial_redemptions
  drop constraint if exists workspace_trial_redemptions_org_id_fkey;
alter table public.workspace_trial_redemptions
  add constraint workspace_trial_redemptions_org_id_fkey
  foreign key (org_id) references public.organizations(id) on delete set null;

-- Clear a closed/expired Stripe session under the same workspace lock before a
-- new checkout lease is claimed. Service-role only: the API has already checked
-- ownership before calling it.
create or replace function public.release_workspace_checkout_session(
  p_org_id uuid, p_stripe_checkout_session_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('workspace-checkout:' || p_org_id::text, 0));
  update public.organization_billing
  set stripe_checkout_session_id = null
  where org_id = p_org_id
    and stripe_checkout_session_id = p_stripe_checkout_session_id
    and checkout_claim_token is null;
end;
$$;

revoke all on function public.release_workspace_checkout_session(uuid, text) from public, anon, authenticated;
grant execute on function public.release_workspace_checkout_session(uuid, text) to service_role;
