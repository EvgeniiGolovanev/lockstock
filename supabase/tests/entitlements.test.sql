begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

insert into public.organizations (id, name)
select
  ('61000000-0000-0000-0000-' || lpad(series::text, 12, '0'))::uuid,
  'Entitlement case ' || series
from generate_series(1, 15) as series;

insert into public.organization_billing (
  org_id, plan, status, billing_interval, trial_ends_at, current_period_end, past_due_since
)
values
  ('61000000-0000-0000-0000-000000000001', 'business', 'active', 'monthly', null, now() - interval '1 day', null),
  ('61000000-0000-0000-0000-000000000002', 'business', 'trialing', 'monthly', now() + interval '1 second', null, null),
  ('61000000-0000-0000-0000-000000000003', 'business', 'trialing', 'monthly', now(), null, null),
  ('61000000-0000-0000-0000-000000000004', 'business', 'trialing', 'monthly', now() - interval '1 microsecond', null, null),
  ('61000000-0000-0000-0000-000000000005', 'business', 'past_due', 'monthly', null, null, now() - interval '6 days'),
  ('61000000-0000-0000-0000-000000000006', 'business', 'past_due', 'monthly', null, null, now() - interval '7 days'),
  ('61000000-0000-0000-0000-000000000007', 'business', 'past_due', 'monthly', null, null, now() - interval '7 days 1 microsecond'),
  ('61000000-0000-0000-0000-000000000009', 'starter', 'cancelled', 'monthly', null, null, null),
  ('61000000-0000-0000-0000-000000000010', 'starter', 'unpaid', 'monthly', null, null, null),
  ('61000000-0000-0000-0000-000000000011', 'starter', 'incomplete', 'monthly', null, null, null),
  ('61000000-0000-0000-0000-000000000012', 'starter', 'incomplete_expired', 'monthly', null, null, null),
  ('61000000-0000-0000-0000-000000000013', 'starter', 'paused', 'monthly', null, null, null),
  ('61000000-0000-0000-0000-000000000014', 'starter', 'trialing', 'monthly', null, null, null),
  ('61000000-0000-0000-0000-000000000015', 'starter', 'past_due', 'monthly', null, null, null);

select ok(
  public.workspace_has_write_access('61000000-0000-0000-0000-000000000001'),
  'active remains writable even when current_period_end is in the past'
);
select ok(public.workspace_has_write_access('61000000-0000-0000-0000-000000000002'), 'future trial is writable');
select ok(public.workspace_has_write_access('61000000-0000-0000-0000-000000000003'), 'trial boundary equality is writable');
select ok(not public.workspace_has_write_access('61000000-0000-0000-0000-000000000004'), 'expired trial is read-only');
select ok(public.workspace_has_write_access('61000000-0000-0000-0000-000000000005'), 'past-due grace is writable');
select ok(public.workspace_has_write_access('61000000-0000-0000-0000-000000000006'), 'grace boundary equality is writable');
select ok(not public.workspace_has_write_access('61000000-0000-0000-0000-000000000007'), 'expired grace is read-only');
select ok(not public.workspace_has_write_access('61000000-0000-0000-0000-000000000008'), 'missing billing is read-only');
select ok(not public.workspace_has_write_access('61000000-0000-0000-0000-000000000009'), 'cancelled is read-only');
select ok(not public.workspace_has_write_access('61000000-0000-0000-0000-000000000010'), 'unpaid is read-only');
select ok(not public.workspace_has_write_access('61000000-0000-0000-0000-000000000011'), 'incomplete is read-only');
select ok(not public.workspace_has_write_access('61000000-0000-0000-0000-000000000012'), 'incomplete_expired is read-only');
select ok(not public.workspace_has_write_access('61000000-0000-0000-0000-000000000013'), 'paused is read-only');
select ok(not public.workspace_has_write_access('61000000-0000-0000-0000-000000000014'), 'trialing without an end is read-only');
select ok(not public.workspace_has_write_access('61000000-0000-0000-0000-000000000015'), 'past_due without a start is read-only');

set local time zone 'Pacific/Auckland';
select ok(
  public.workspace_has_write_access('61000000-0000-0000-0000-000000000003'),
  'write-access decision is independent of the session time zone'
);

select * from finish();

rollback;
