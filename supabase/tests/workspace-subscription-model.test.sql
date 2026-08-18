begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000001","email":"workspace-owner@example.test","role":"authenticated"}',
  true
);

create temp table workspace_subscription_orgs (
  id uuid primary key,
  label text not null
);

insert into workspace_subscription_orgs (id, label)
select (public.create_organization_with_owner(
  'First subscribed workspace',
  'business'::public.billing_plan,
  true
)).id, 'first';

insert into workspace_subscription_orgs (id, label)
select (public.create_organization_with_owner(
  'Second independently billed workspace',
  'operations'::public.billing_plan,
  false
)).id, 'second';

reset role;

select is(
  (select count(*) from workspace_subscription_orgs),
  2::bigint,
  'an owner can create a second independently billed workspace'
);

select isnt(
  (select id from workspace_subscription_orgs where label = 'first'),
  (select id from workspace_subscription_orgs where label = 'second'),
  'creating a second workspace does not return the first owned workspace'
);

select is(
  (
    select count(*)
    from public.org_users memberships
    join workspace_subscription_orgs created on created.id = memberships.org_id
    where memberships.user_id = '91000000-0000-0000-0000-000000000001'
      and memberships.role = 'owner'
  ),
  2::bigint,
  'the same account owns both workspaces without merging their memberships'
);

select is(
  (
    select status::text
    from public.organization_billing billing
    join workspace_subscription_orgs created on created.id = billing.org_id
    where created.label = 'first'
  ),
  'trialing',
  'the first workspace has the account trial'
);

select is(
  (
    select status::text
    from public.organization_billing billing
    join workspace_subscription_orgs created on created.id = billing.org_id
    where created.label = 'second'
  ),
  'incomplete',
  'the second workspace starts without a borrowed subscription or trial'
);

select is(
  (
    select plan::text
    from public.organization_billing billing
    join workspace_subscription_orgs created on created.id = billing.org_id
    where created.label = 'second'
  ),
  'operations',
  'the second workspace retains its own selected subscription plan'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000001","email":"workspace-owner@example.test","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.create_organization_with_owner(
    'Attempted second trial',
    'starter'::public.billing_plan,
    true
  )$$,
  '42501',
  'Trial already redeemed',
  'a second workspace cannot restart the account trial'
);

reset role;

select is(
  (select count(*) from public.workspace_trial_redemptions where user_id = '91000000-0000-0000-0000-000000000001'),
  1::bigint,
  'the account has exactly one durable trial redemption record'
);

select * from finish();

rollback;
