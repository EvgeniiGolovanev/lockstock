-- This is an account-wide redemption ledger, not a client data surface.
-- Protected SECURITY DEFINER RPCs are its only application entry points.
alter table public.workspace_trial_redemptions enable row level security;

revoke all on table public.workspace_trial_redemptions from public, anon, authenticated;
