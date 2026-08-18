begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

create function pg_temp.try_sql(statement text)
returns text
language plpgsql
as $$
begin
  execute statement;
  return 'ok';
exception when others then
  return sqlstate;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-0000-0000-000000000001","email":"trial-plan@example.test","role":"authenticated"}',
  true
);

create temp table trial_workspace_ids (org_id uuid primary key);
insert into trial_workspace_ids
select (public.create_organization_with_owner('Trial Plan Org', 'business'::public.billing_plan, true)).id;

-- Billing columns are intentionally not exposed to an ordinary workspace
-- member. The remaining assertions validate server-side state.
reset role;

select is(
  (select plan::text from public.organization_billing where org_id = (select org_id from trial_workspace_ids)),
  'business',
  'selected business plan survives trial workspace creation'
);

select is(
  (select status::text from public.organization_billing where org_id = (select org_id from trial_workspace_ids)),
  'trialing',
  'effective trial access remains trialing starter access'
);

select ok(
  public.workspace_has_write_access((select org_id from trial_workspace_ids)),
  'trial workspace is writable before expiry'
);

update public.organization_billing
set status = 'active',
    trial_ends_at = null
where org_id = (select org_id from trial_workspace_ids);

select is(
  (select plan::text from public.organization_billing where org_id = (select org_id from trial_workspace_ids)),
  'business',
  'later paid activation preserves the selected plan'
);

select is(
  pg_temp.try_sql($$update public.organization_billing
    set status = 'trialing', trial_ends_at = now() - interval '1 second'
    where org_id = (select org_id from trial_workspace_ids)$$),
  'ok',
  'trial expiry can be staged for read-only enforcement'
);

select ok(
  not public.workspace_has_write_access((select org_id from trial_workspace_ids)),
  'expired trial becomes read-only'
);

select * from finish();

rollback;
