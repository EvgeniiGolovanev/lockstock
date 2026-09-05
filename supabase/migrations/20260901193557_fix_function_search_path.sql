-- Pin lookup resolution for the public helpers and trigger functions flagged
-- by the Security Advisor. ALTER FUNCTION preserves each function body, owner,
-- and EXECUTE grants while removing reliance on a caller-controlled search_path.
alter function public.is_org_owner(uuid) set search_path to public;
alter function public.set_updated_at() set search_path to public;
alter function public.assign_supplier_vendor_number() set search_path to public;
