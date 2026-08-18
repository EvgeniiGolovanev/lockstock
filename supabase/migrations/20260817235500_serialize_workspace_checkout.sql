-- A checkout lease serializes the external Stripe side effect for one workspace.
alter table public.organization_billing
  add column if not exists checkout_claim_token uuid,
  add column if not exists checkout_claimed_at timestamptz;

create or replace function public.claim_workspace_checkout(p_org_id uuid)
returns table (state text, claim_token uuid, stripe_customer_id text, stripe_checkout_session_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_billing public.organization_billing%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('workspace-checkout:' || p_org_id::text, 0));
  select * into v_billing from public.organization_billing where org_id = p_org_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Organization billing record not found'; end if;
  if v_billing.stripe_subscription_id is not null and v_billing.status in ('active', 'past_due') then
    raise exception using errcode = '23514', message = 'Workspace already has a paid subscription';
  end if;
  if v_billing.stripe_checkout_session_id is not null then
    return query select 'existing', null::uuid, v_billing.stripe_customer_id, v_billing.stripe_checkout_session_id;
    return;
  end if;
  if v_billing.checkout_claim_token is not null then
    if v_billing.checkout_claimed_at < timezone('utc', now()) - interval '5 minutes' then
      update public.organization_billing set checkout_claimed_at = timezone('utc', now()) where org_id = p_org_id;
      return query select 'claimed', v_billing.checkout_claim_token, v_billing.stripe_customer_id, null::text;
    else
      return query select 'pending', null::uuid, v_billing.stripe_customer_id, null::text;
    end if;
    return;
  end if;
  update public.organization_billing
  set checkout_claim_token = gen_random_uuid(), checkout_claimed_at = timezone('utc', now())
  where org_id = p_org_id
  returning checkout_claim_token, stripe_customer_id into claim_token, stripe_customer_id;
  state := 'claimed';
  stripe_checkout_session_id := null;
  return next;
end;
$$;

create or replace function public.complete_workspace_checkout_claim(
  p_org_id uuid, p_claim_token uuid, p_stripe_customer_id text, p_stripe_checkout_session_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.organization_billing
  set stripe_customer_id = coalesce(stripe_customer_id, p_stripe_customer_id),
      stripe_checkout_session_id = p_stripe_checkout_session_id,
      checkout_claim_token = null,
      checkout_claimed_at = null
  where org_id = p_org_id and checkout_claim_token = p_claim_token;
  if not found then raise exception using errcode = '40001', message = 'Checkout claim was lost'; end if;
end;
$$;

revoke all on function public.claim_workspace_checkout(uuid) from public, anon, authenticated;
revoke all on function public.complete_workspace_checkout_claim(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_workspace_checkout(uuid) to service_role;
grant execute on function public.complete_workspace_checkout_claim(uuid, uuid, text, text) to service_role;
