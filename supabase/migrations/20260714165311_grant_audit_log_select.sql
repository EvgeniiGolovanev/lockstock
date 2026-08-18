-- Account audit reads use the authenticated Data API and platform overview uses the service client.
-- RLS continues to constrain user-visible audit rows.
grant select on table public.audit_log to authenticated;
grant select on table public.audit_log to service_role;
