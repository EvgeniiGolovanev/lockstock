create extension if not exists "pgcrypto";

create type public.org_role as enum ('owner', 'manager', 'member', 'viewer');
create type public.po_status as enum ('draft', 'sent', 'partial', 'received', 'cancelled');
create type public.movement_reason as enum ('adjustment', 'transfer_in', 'transfer_out', 'purchase_receive', 'correction');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.org_users (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role public.org_role not null default 'member',
  created_at timestamptz not null default timezone('utc', now()),
  primary key (org_id, user_id)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (org_id, name)
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (team_id, user_id)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (org_id, code)
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  sku text not null,
  name text not null,
  description text,
  uom text not null default 'unit',
  min_stock numeric(14, 3) not null default 0,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (org_id, sku)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  lead_time_days integer not null default 0,
  payment_terms text,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (org_id, name)
);

create table public.supplier_materials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null,
  material_id uuid not null,
  supplier_sku text,
  last_price numeric(14, 2),
  currency text not null default 'USD',
  preferred boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (org_id, supplier_id, material_id)
);

create table public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  material_id uuid not null,
  location_id uuid not null,
  quantity numeric(14, 3) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (org_id, material_id, location_id),
  check (quantity >= 0)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  material_id uuid not null,
  location_id uuid not null,
  quantity_delta numeric(14, 3) not null,
  reason public.movement_reason not null,
  note text,
  reference_type text,
  reference_id uuid,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null,
  po_number text not null,
  status public.po_status not null default 'draft',
  expected_at date,
  notes text,
  sent_at timestamptz,
  received_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (org_id, po_number)
);

create table public.po_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  purchase_order_id uuid not null,
  material_id uuid not null,
  quantity_ordered numeric(14, 3) not null check (quantity_ordered > 0),
  quantity_received numeric(14, 3) not null default 0 check (quantity_received >= 0),
  unit_price numeric(14, 2),
  created_at timestamptz not null default timezone('utc', now()),
  check (quantity_received <= quantity_ordered)
);

alter table public.teams
  add constraint uq_teams_id_org unique (id, org_id);
alter table public.locations
  add constraint uq_locations_id_org unique (id, org_id);
alter table public.materials
  add constraint uq_materials_id_org unique (id, org_id);
alter table public.suppliers
  add constraint uq_suppliers_id_org unique (id, org_id);
alter table public.purchase_orders
  add constraint uq_purchase_orders_id_org unique (id, org_id);

alter table public.supplier_materials
  add constraint fk_supplier_materials_supplier_org
  foreign key (supplier_id, org_id) references public.suppliers (id, org_id) on delete cascade;
alter table public.supplier_materials
  add constraint fk_supplier_materials_material_org
  foreign key (material_id, org_id) references public.materials (id, org_id) on delete cascade;
alter table public.inventory_balances
  add constraint fk_inventory_balances_material_org
  foreign key (material_id, org_id) references public.materials (id, org_id) on delete cascade;
alter table public.inventory_balances
  add constraint fk_inventory_balances_location_org
  foreign key (location_id, org_id) references public.locations (id, org_id) on delete cascade;
alter table public.stock_movements
  add constraint fk_stock_movements_material_org
  foreign key (material_id, org_id) references public.materials (id, org_id) on delete cascade;
alter table public.stock_movements
  add constraint fk_stock_movements_location_org
  foreign key (location_id, org_id) references public.locations (id, org_id) on delete cascade;
alter table public.purchase_orders
  add constraint fk_purchase_orders_supplier_org
  foreign key (supplier_id, org_id) references public.suppliers (id, org_id) on delete restrict;
alter table public.po_lines
  add constraint fk_po_lines_purchase_order_org
  foreign key (purchase_order_id, org_id) references public.purchase_orders (id, org_id) on delete cascade;
alter table public.po_lines
  add constraint fk_po_lines_material_org
  foreign key (material_id, org_id) references public.materials (id, org_id) on delete restrict;

create index idx_org_users_user_id on public.org_users (user_id);
create index idx_teams_org_id on public.teams (org_id);
create index idx_locations_org_id on public.locations (org_id);
create index idx_materials_org_id on public.materials (org_id);
create index idx_suppliers_org_id on public.suppliers (org_id);
create index idx_supplier_materials_org_id on public.supplier_materials (org_id);
create index idx_inventory_balances_org_material on public.inventory_balances (org_id, material_id);
create index idx_stock_movements_org_material on public.stock_movements (org_id, material_id, created_at desc);
create index idx_purchase_orders_org_id on public.purchase_orders (org_id, created_at desc);
create index idx_po_lines_po_id on public.po_lines (purchase_order_id);

create trigger trg_organizations_updated_at
before update on public.organizations
for each row execute procedure public.set_updated_at();

create trigger trg_teams_updated_at
before update on public.teams
for each row execute procedure public.set_updated_at();

create trigger trg_locations_updated_at
before update on public.locations
for each row execute procedure public.set_updated_at();

create trigger trg_materials_updated_at
before update on public.materials
for each row execute procedure public.set_updated_at();

create trigger trg_suppliers_updated_at
before update on public.suppliers
for each row execute procedure public.set_updated_at();

create trigger trg_inventory_balances_updated_at
before update on public.inventory_balances
for each row execute procedure public.set_updated_at();

create trigger trg_purchase_orders_updated_at
before update on public.purchase_orders
for each row execute procedure public.set_updated_at();

create or replace function public.create_stock_movement(
  p_org_id uuid,
  p_material_id uuid,
  p_location_id uuid,
  p_quantity_delta numeric,
  p_reason public.movement_reason,
  p_note text default null,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing numeric(14, 3);
  v_new_balance numeric(14, 3);
  v_movement_id uuid := gen_random_uuid();
begin
  if p_quantity_delta = 0 then
    raise exception 'quantity_delta cannot be zero';
  end if;

  perform 1
  from public.materials
  where id = p_material_id and org_id = p_org_id;
  if not found then
    raise exception 'Material does not exist in this organization';
  end if;

  perform 1
  from public.locations
  where id = p_location_id and org_id = p_org_id;
  if not found then
    raise exception 'Location does not exist in this organization';
  end if;

  select quantity
  into v_existing
  from public.inventory_balances
  where org_id = p_org_id and material_id = p_material_id and location_id = p_location_id
  for update;

  if not found then
    v_existing := 0;
  end if;

  v_new_balance := v_existing + p_quantity_delta;

  if v_new_balance < 0 then
    raise exception 'Insufficient stock for this movement';
  end if;

  insert into public.inventory_balances (org_id, material_id, location_id, quantity)
  values (p_org_id, p_material_id, p_location_id, p_quantity_delta)
  on conflict (org_id, material_id, location_id)
  do update
    set quantity = public.inventory_balances.quantity + excluded.quantity,
        updated_at = timezone('utc', now());

  insert into public.stock_movements (
    id,
    org_id,
    material_id,
    location_id,
    quantity_delta,
    reason,
    note,
    reference_type,
    reference_id,
    created_by
  )
  values (
    v_movement_id,
    p_org_id,
    p_material_id,
    p_location_id,
    p_quantity_delta,
    p_reason,
    p_note,
    p_reference_type,
    p_reference_id,
    p_created_by
  );

  return v_movement_id;
end;
$$;

create or replace function public.receive_purchase_order(
  p_org_id uuid,
  p_po_id uuid,
  p_received_by uuid,
  p_receipts jsonb
)
returns table (
  po_status public.po_status,
  total_lines integer,
  fully_received_lines integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po record;
  v_item jsonb;
  v_line record;
  v_qty numeric(14, 3);
  v_location_id uuid;
  v_status public.po_status;
begin
  if jsonb_typeof(p_receipts) <> 'array' then
    raise exception 'receipts must be a JSON array';
  end if;

  select *
  into v_po
  from public.purchase_orders
  where id = p_po_id and org_id = p_org_id
  for update;

  if not found then
    raise exception 'Purchase order not found in this organization';
  end if;

  if v_po.status = 'cancelled' then
    raise exception 'Cancelled purchase orders cannot be received';
  end if;

  for v_item in
    select value from jsonb_array_elements(p_receipts)
  loop
    v_qty := (v_item ->> 'quantity_received')::numeric;
    v_location_id := (v_item ->> 'location_id')::uuid;

    if v_qty is null or v_qty <= 0 then
      raise exception 'quantity_received must be greater than zero';
    end if;

    select *
    into v_line
    from public.po_lines
    where id = (v_item ->> 'po_line_id')::uuid
      and purchase_order_id = p_po_id
      and org_id = p_org_id
    for update;

    if not found then
      raise exception 'PO line does not exist in this purchase order';
    end if;

    if v_line.quantity_received + v_qty > v_line.quantity_ordered then
      raise exception 'Receiving quantity exceeds quantity_ordered for line %', v_line.id;
    end if;

    update public.po_lines
    set quantity_received = quantity_received + v_qty
    where id = v_line.id;

    perform public.create_stock_movement(
      p_org_id,
      v_line.material_id,
      v_location_id,
      v_qty,
      'purchase_receive',
      'Received from purchase order',
      'purchase_order',
      p_po_id,
      p_received_by
    );
  end loop;

  select
    count(*)::integer,
    count(*) filter (where quantity_received >= quantity_ordered)::integer
  into total_lines, fully_received_lines
  from public.po_lines
  where purchase_order_id = p_po_id and org_id = p_org_id;

  if fully_received_lines = total_lines then
    v_status := 'received';
  else
    v_status := 'partial';
  end if;

  update public.purchase_orders
  set status = v_status,
      received_at = case when v_status = 'received' then timezone('utc', now()) else received_at end,
      updated_at = timezone('utc', now())
  where id = p_po_id;

  return query
  select v_status, total_lines, fully_received_lines;
end;
$$;

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.org_users ou
    where ou.org_id = target_org_id
      and ou.user_id = auth.uid()
  );
$$;

alter table public.organizations enable row level security;
alter table public.org_users enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.locations enable row level security;
alter table public.materials enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_materials enable row level security;
alter table public.inventory_balances enable row level security;
alter table public.stock_movements enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.po_lines enable row level security;

create policy org_access_organizations on public.organizations
for all using (public.is_org_member(id)) with check (public.is_org_member(id));

create policy org_access_org_users on public.org_users
for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy org_access_teams on public.teams
for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy org_access_locations on public.locations
for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy org_access_materials on public.materials
for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy org_access_suppliers on public.suppliers
for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy org_access_supplier_materials on public.supplier_materials
for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy org_access_inventory_balances on public.inventory_balances
for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy org_access_stock_movements on public.stock_movements
for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy org_access_purchase_orders on public.purchase_orders
for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy org_access_po_lines on public.po_lines
for all
using (
  exists (
    select 1
    from public.purchase_orders po
    where po.id = po_lines.purchase_order_id
      and public.is_org_member(po.org_id)
  )
)
with check (
  exists (
    select 1
    from public.purchase_orders po
    where po.id = po_lines.purchase_order_id
      and public.is_org_member(po.org_id)
  )
);

create policy org_access_team_members on public.team_members
for all
using (
  exists (
    select 1
    from public.teams t
    where t.id = team_members.team_id
      and public.is_org_member(t.org_id)
  )
)
with check (
  exists (
    select 1
    from public.teams t
    where t.id = team_members.team_id
      and public.is_org_member(t.org_id)
  )
);
