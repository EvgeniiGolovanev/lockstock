-- Optional development seed. Replace UUIDs with real auth user ids.
-- This script assumes migration 202602231350_init.sql is already applied.

insert into public.organizations (id, name)
values ('11111111-1111-1111-1111-111111111111', 'LockStock Demo')
on conflict (id) do nothing;

insert into public.org_users (org_id, user_id, role)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner')
on conflict (org_id, user_id) do nothing;

insert into public.locations (id, org_id, code, name)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'MAIN', 'Main Warehouse')
on conflict (id) do nothing;
