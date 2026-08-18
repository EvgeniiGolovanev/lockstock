create index if not exists idx_teams_org_created_at
  on public.teams (org_id, created_at desc);

create index if not exists idx_suppliers_org_active_vendor_created
  on public.suppliers (org_id, is_active, vendor_number, created_at);
