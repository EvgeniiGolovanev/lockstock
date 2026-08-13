-- Supabase Data API checks table privileges before RLS policies.
-- Membership reads are still constrained by org_users_select_self_or_manager.
grant select on table public.org_users to authenticated;
