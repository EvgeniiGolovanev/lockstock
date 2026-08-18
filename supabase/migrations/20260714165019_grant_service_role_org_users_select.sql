-- Server-side billing ownership checks read org_users through the service client.
grant select on table public.org_users to service_role;
