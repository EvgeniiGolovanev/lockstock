begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

select set_eq(
  $$
    select p.proname::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('is_org_owner', 'set_updated_at', 'assign_supplier_vendor_number')
      and coalesce(p.proconfig, array[]::text[]) @> array['search_path=public']
  $$,
  $$
    values
      ('assign_supplier_vendor_number'::text),
      ('is_org_owner'::text),
      ('set_updated_at'::text)
  $$,
  'public helper and trigger functions use an immutable search path'
);

select set_eq(
  $$
    select p.proname::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  $$,
  $$
    values
      ('accept_org_invitation'::text),
      ('claim_stripe_webhook_event'::text),
      ('claim_workspace_checkout'::text),
      ('complete_workspace_checkout_claim'::text),
      ('complete_stripe_webhook_event'::text),
      ('fail_stripe_webhook_event'::text),
      ('create_organization_with_owner'::text),
      ('create_purchase_order_with_lines'::text),
      ('create_team_with_owner'::text),
      ('create_stock_movement'::text),
      ('create_stock_transfer'::text),
      ('derive_workspace_actor'::text),
      ('enforce_organization_plan_insert_limit'::text),
      ('enforce_workspace_mutation_access'::text),
      ('get_org_member_account_profiles'::text),
      ('is_org_member'::text),
      ('is_org_role_at_least'::text),
      ('receive_purchase_order'::text),
      ('release_workspace_checkout_session'::text),
      ('start_workspace_trial'::text),
      ('transition_purchase_order_status'::text),
      ('reject_org_invitation'::text),
      ('remove_org_member_with_team_memberships'::text),
      ('workspace_has_write_access'::text),
      ('write_audit_log'::text)
      ,('consume_public_rate_limit'::text)
  $$,
  'the SECURITY DEFINER inventory is explicit and complete'
);

select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
  ),
  0::bigint,
  'anon has no effective execute privilege on any SECURITY DEFINER function'
);

select is(
  (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and (
        has_table_privilege('anon', c.oid, 'truncate')
        or has_table_privilege('authenticated', c.oid, 'truncate')
      )
  ),
  0::bigint,
  'anon and authenticated cannot bypass RLS and guards with TRUNCATE'
);

select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'derive_workspace_actor',
        'enforce_organization_plan_insert_limit',
        'enforce_workspace_mutation_access',
        'write_audit_log'
      )
      and has_function_privilege('authenticated', p.oid, 'execute')
  ),
  0::bigint,
  'authenticated cannot invoke privileged trigger functions as RPCs'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.apply_stock_movement_internal(uuid,uuid,uuid,numeric,public.movement_reason,text,text,uuid,uuid)',
    'execute'
  ),
  'authenticated cannot invoke the internal stock primitive as an RPC'
);

select set_eq(
  $$
    select p.proname::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'claim_stripe_webhook_event',
        'complete_stripe_webhook_event',
        'fail_stripe_webhook_event'
      )
      and has_function_privilege('service_role', p.oid, 'execute')
  $$,
  $$
    values
      ('claim_stripe_webhook_event'::text),
      ('complete_stripe_webhook_event'::text),
      ('fail_stripe_webhook_event'::text)
  $$,
  'service_role can invoke the Stripe webhook ledger functions'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_stripe_webhook_event(text,text,timestamptz,interval)'::regprocedure,
    'execute'
  ),
  'authenticated cannot invoke the Stripe webhook ledger claim RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.complete_stripe_webhook_event(text)'::regprocedure,
    'execute'
  ),
  'authenticated cannot invoke the Stripe webhook ledger completion RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.fail_stripe_webhook_event(text,text,text)'::regprocedure,
    'execute'
  ),
  'authenticated cannot invoke the Stripe webhook ledger failure RPC'
);

select ok(
  not has_function_privilege('anon', 'public.consume_public_rate_limit(text,text)'::regprocedure, 'execute'),
  'anon cannot invoke the durable rate-limit RPC'
);

select ok(
  not has_function_privilege('authenticated', 'public.consume_public_rate_limit(text,text)'::regprocedure, 'execute'),
  'authenticated cannot invoke the durable rate-limit RPC'
);

select ok(
  has_function_privilege('service_role', 'public.consume_public_rate_limit(text,text)'::regprocedure, 'execute'),
  'service_role can invoke the durable rate-limit RPC'
);

select set_eq(
  $$
    select p.proname::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'accept_org_invitation',
        'create_organization_with_owner',
        'create_purchase_order_with_lines',
        'create_team_with_owner',
        'create_stock_movement',
        'create_stock_transfer',
        'receive_purchase_order',
        'transition_purchase_order_status',
        'reject_org_invitation',
        'remove_org_member_with_team_memberships'
      )
      and has_function_privilege('authenticated', p.oid, 'execute')
  $$,
  $$
    values
      ('accept_org_invitation'::text),
      ('create_organization_with_owner'::text),
      ('create_purchase_order_with_lines'::text),
      ('create_team_with_owner'::text),
      ('create_stock_movement'::text),
      ('create_stock_transfer'::text),
      ('receive_purchase_order'::text),
      ('transition_purchase_order_status'::text),
      ('reject_org_invitation'::text),
      ('remove_org_member_with_team_memberships'::text)
  $$,
  'authenticated retains only the intended client mutation RPC entry points'
);

insert into public.organizations (id, name)
values ('62000000-0000-0000-0000-000000000001', 'Service billing sync org');
insert into public.organization_billing (org_id, plan, status, billing_interval)
values ('62000000-0000-0000-0000-000000000001', 'starter', 'active', 'monthly');

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select lives_ok(
  $$update public.organization_billing
    set status = 'cancelled', stripe_customer_id = 'cus_db_test'
    where org_id = '62000000-0000-0000-0000-000000000001'$$,
  'service_role Stripe synchronization can update billing rows'
);

select is(
  (
    select status::text
    from public.organization_billing
    where org_id = '62000000-0000-0000-0000-000000000001'
  ),
  'cancelled',
  'service_role billing update persists'
);

select lives_ok(
  $$insert into public.stripe_webhook_events (event_id, event_type, event_created_at)
    values ('evt_p001_db', 'customer.subscription.updated', now())$$,
  'service_role retains Stripe webhook event writes'
);

select is(
  (select count(*) from public.stripe_webhook_events where event_id = 'evt_p001_db'),
  1::bigint,
  'service_role Stripe webhook event write persists'
);

reset role;

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.workspace_trial_redemptions'::regclass
  ),
  'workspace trial redemption ledger has RLS enabled'
);

select ok(
  not has_table_privilege('anon', 'public.workspace_trial_redemptions', 'select,insert,update,delete')
  and not has_table_privilege('authenticated', 'public.workspace_trial_redemptions', 'select,insert,update,delete'),
  'client roles have no direct access to the workspace trial redemption ledger'
);

select * from finish();

rollback;
