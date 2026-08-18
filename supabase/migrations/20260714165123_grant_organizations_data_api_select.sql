-- /api/organizations joins org_users to organizations through the authenticated Data API.
-- RLS policies still constrain which organization rows are visible.
grant select on table public.organizations to authenticated;
