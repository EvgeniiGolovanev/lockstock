create or replace function public.is_org_role_at_least(target_org_id uuid, minimum_role public.org_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_users ou
    where ou.org_id = target_org_id
      and ou.user_id = auth.uid()
      and (
        case ou.role
          when 'owner' then 3
          when 'manager' then 2
          when 'member' then 1
          when 'viewer' then 0
        end
      ) >= (
        case minimum_role
          when 'owner' then 3
          when 'manager' then 2
          when 'member' then 1
          when 'viewer' then 0
        end
      )
  );
$$;

revoke all on function public.is_org_role_at_least(uuid, public.org_role) from public;
grant execute on function public.is_org_role_at_least(uuid, public.org_role) to authenticated;
grant execute on function public.is_org_role_at_least(uuid, public.org_role) to service_role;

drop policy if exists org_access_organizations on public.organizations;
drop policy if exists org_select_organizations on public.organizations;
drop policy if exists org_owner_update_organizations on public.organizations;
drop policy if exists org_owner_delete_organizations on public.organizations;
create policy org_select_organizations on public.organizations
for select using (public.is_org_member(id));
create policy org_owner_update_organizations on public.organizations
for update using (public.is_org_role_at_least(id, 'owner')) with check (public.is_org_role_at_least(id, 'owner'));
create policy org_owner_delete_organizations on public.organizations
for delete using (public.is_org_role_at_least(id, 'owner'));

drop policy if exists org_access_org_users on public.org_users;
drop policy if exists org_users_select_self_or_manager on public.org_users;
drop policy if exists org_owner_insert_org_users on public.org_users;
drop policy if exists org_owner_update_org_users on public.org_users;
drop policy if exists org_owner_delete_org_users on public.org_users;
create policy org_users_select_self_or_manager on public.org_users
for select using (user_id = auth.uid() or public.is_org_role_at_least(org_id, 'manager'));
create policy org_owner_insert_org_users on public.org_users
for insert with check (public.is_org_role_at_least(org_id, 'owner'));
create policy org_owner_update_org_users on public.org_users
for update using (public.is_org_role_at_least(org_id, 'owner')) with check (public.is_org_role_at_least(org_id, 'owner'));
create policy org_owner_delete_org_users on public.org_users
for delete using (public.is_org_role_at_least(org_id, 'owner'));

drop policy if exists org_access_teams on public.teams;
drop policy if exists org_select_teams on public.teams;
drop policy if exists org_manager_insert_teams on public.teams;
drop policy if exists org_manager_update_teams on public.teams;
drop policy if exists org_manager_delete_teams on public.teams;
create policy org_select_teams on public.teams
for select using (public.is_org_member(org_id));
create policy org_manager_insert_teams on public.teams
for insert with check (public.is_org_role_at_least(org_id, 'manager'));
create policy org_manager_update_teams on public.teams
for update using (public.is_org_role_at_least(org_id, 'manager')) with check (public.is_org_role_at_least(org_id, 'manager'));
create policy org_manager_delete_teams on public.teams
for delete using (public.is_org_role_at_least(org_id, 'manager'));

drop policy if exists org_access_team_members on public.team_members;
drop policy if exists org_select_team_members on public.team_members;
drop policy if exists org_manager_insert_team_members on public.team_members;
drop policy if exists org_manager_delete_team_members on public.team_members;
create policy org_select_team_members on public.team_members
for select using (
  exists (
    select 1 from public.teams t
    where t.id = team_members.team_id
      and public.is_org_member(t.org_id)
  )
);
create policy org_manager_insert_team_members on public.team_members
for insert with check (
  exists (
    select 1 from public.teams t
    where t.id = team_members.team_id
      and public.is_org_role_at_least(t.org_id, 'manager')
  )
);
create policy org_manager_delete_team_members on public.team_members
for delete using (
  exists (
    select 1 from public.teams t
    where t.id = team_members.team_id
      and public.is_org_role_at_least(t.org_id, 'manager')
  )
);

drop policy if exists org_access_locations on public.locations;
drop policy if exists org_select_locations on public.locations;
drop policy if exists org_manager_insert_locations on public.locations;
drop policy if exists org_manager_update_locations on public.locations;
drop policy if exists org_manager_delete_locations on public.locations;
create policy org_select_locations on public.locations
for select using (public.is_org_member(org_id));
create policy org_manager_insert_locations on public.locations
for insert with check (public.is_org_role_at_least(org_id, 'manager'));
create policy org_manager_update_locations on public.locations
for update using (public.is_org_role_at_least(org_id, 'manager')) with check (public.is_org_role_at_least(org_id, 'manager'));
create policy org_manager_delete_locations on public.locations
for delete using (public.is_org_role_at_least(org_id, 'manager'));

drop policy if exists org_access_materials on public.materials;
drop policy if exists org_select_materials on public.materials;
drop policy if exists org_manager_insert_materials on public.materials;
drop policy if exists org_manager_update_materials on public.materials;
drop policy if exists org_manager_delete_materials on public.materials;
create policy org_select_materials on public.materials
for select using (public.is_org_member(org_id));
create policy org_manager_insert_materials on public.materials
for insert with check (public.is_org_role_at_least(org_id, 'manager'));
create policy org_manager_update_materials on public.materials
for update using (public.is_org_role_at_least(org_id, 'manager')) with check (public.is_org_role_at_least(org_id, 'manager'));
create policy org_manager_delete_materials on public.materials
for delete using (public.is_org_role_at_least(org_id, 'manager'));

drop policy if exists org_access_suppliers on public.suppliers;
drop policy if exists org_select_suppliers on public.suppliers;
drop policy if exists org_manager_insert_suppliers on public.suppliers;
drop policy if exists org_manager_update_suppliers on public.suppliers;
drop policy if exists org_manager_delete_suppliers on public.suppliers;
create policy org_select_suppliers on public.suppliers
for select using (public.is_org_member(org_id));
create policy org_manager_insert_suppliers on public.suppliers
for insert with check (public.is_org_role_at_least(org_id, 'manager'));
create policy org_manager_update_suppliers on public.suppliers
for update using (public.is_org_role_at_least(org_id, 'manager')) with check (public.is_org_role_at_least(org_id, 'manager'));
create policy org_manager_delete_suppliers on public.suppliers
for delete using (public.is_org_role_at_least(org_id, 'manager'));

drop policy if exists org_access_supplier_materials on public.supplier_materials;
drop policy if exists org_select_supplier_materials on public.supplier_materials;
drop policy if exists org_manager_insert_supplier_materials on public.supplier_materials;
drop policy if exists org_manager_update_supplier_materials on public.supplier_materials;
drop policy if exists org_manager_delete_supplier_materials on public.supplier_materials;
create policy org_select_supplier_materials on public.supplier_materials
for select using (public.is_org_member(org_id));
create policy org_manager_insert_supplier_materials on public.supplier_materials
for insert with check (public.is_org_role_at_least(org_id, 'manager'));
create policy org_manager_update_supplier_materials on public.supplier_materials
for update using (public.is_org_role_at_least(org_id, 'manager')) with check (public.is_org_role_at_least(org_id, 'manager'));
create policy org_manager_delete_supplier_materials on public.supplier_materials
for delete using (public.is_org_role_at_least(org_id, 'manager'));

drop policy if exists org_access_inventory_balances on public.inventory_balances;
drop policy if exists org_select_inventory_balances on public.inventory_balances;
create policy org_select_inventory_balances on public.inventory_balances
for select using (public.is_org_member(org_id));

drop policy if exists org_access_stock_movements on public.stock_movements;
drop policy if exists org_select_stock_movements on public.stock_movements;
create policy org_select_stock_movements on public.stock_movements
for select using (public.is_org_member(org_id));

drop policy if exists org_access_purchase_orders on public.purchase_orders;
drop policy if exists org_select_purchase_orders on public.purchase_orders;
drop policy if exists org_manager_insert_purchase_orders on public.purchase_orders;
drop policy if exists org_manager_update_purchase_orders on public.purchase_orders;
drop policy if exists org_manager_delete_purchase_orders on public.purchase_orders;
create policy org_select_purchase_orders on public.purchase_orders
for select using (public.is_org_member(org_id));
create policy org_manager_insert_purchase_orders on public.purchase_orders
for insert with check (public.is_org_role_at_least(org_id, 'manager'));
create policy org_manager_update_purchase_orders on public.purchase_orders
for update using (public.is_org_role_at_least(org_id, 'manager')) with check (public.is_org_role_at_least(org_id, 'manager'));
create policy org_manager_delete_purchase_orders on public.purchase_orders
for delete using (public.is_org_role_at_least(org_id, 'manager'));

drop policy if exists org_access_po_lines on public.po_lines;
drop policy if exists org_select_po_lines on public.po_lines;
drop policy if exists org_manager_insert_po_lines on public.po_lines;
drop policy if exists org_manager_update_po_lines on public.po_lines;
drop policy if exists org_manager_delete_po_lines on public.po_lines;
create policy org_select_po_lines on public.po_lines
for select using (
  exists (
    select 1 from public.purchase_orders po
    where po.id = po_lines.purchase_order_id
      and public.is_org_member(po.org_id)
  )
);
create policy org_manager_insert_po_lines on public.po_lines
for insert with check (
  exists (
    select 1 from public.purchase_orders po
    where po.id = po_lines.purchase_order_id
      and public.is_org_role_at_least(po.org_id, 'manager')
  )
);
create policy org_manager_update_po_lines on public.po_lines
for update using (
  exists (
    select 1 from public.purchase_orders po
    where po.id = po_lines.purchase_order_id
      and public.is_org_role_at_least(po.org_id, 'manager')
  )
) with check (
  exists (
    select 1 from public.purchase_orders po
    where po.id = po_lines.purchase_order_id
      and public.is_org_role_at_least(po.org_id, 'manager')
  )
);
create policy org_manager_delete_po_lines on public.po_lines
for delete using (
  exists (
    select 1 from public.purchase_orders po
    where po.id = po_lines.purchase_order_id
      and public.is_org_role_at_least(po.org_id, 'manager')
  )
);

drop policy if exists org_select_audit_log on public.audit_log;
drop policy if exists org_role_select_audit_log on public.audit_log;
create policy org_role_select_audit_log on public.audit_log
for select using (
  public.is_org_role_at_least(org_id, 'manager')
  or (
    public.is_org_member(org_id)
    and actor_user_id = auth.uid()
  )
);
