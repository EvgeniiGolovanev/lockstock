alter table public.suppliers
  add column if not exists vendor_number integer,
  add column if not exists address text;

create or replace function public.assign_supplier_vendor_number()
returns trigger
language plpgsql
as $$
declare
  next_vendor_number integer;
begin
  if new.vendor_number is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.org_id::text), 0);

  select coalesce(max(vendor_number), 0) + 1
    into next_vendor_number
    from public.suppliers
   where org_id = new.org_id;

  if next_vendor_number > 99999999 then
    raise exception 'Vendor number range exhausted for organization %', new.org_id;
  end if;

  new.vendor_number := next_vendor_number;
  return new;
end;
$$;

drop trigger if exists trg_suppliers_vendor_number on public.suppliers;
create trigger trg_suppliers_vendor_number
before insert on public.suppliers
for each row
execute function public.assign_supplier_vendor_number();

with ranked_suppliers as (
  select
    id,
    row_number() over (partition by org_id order by created_at asc, id asc) as vendor_number
  from public.suppliers
)
update public.suppliers as suppliers
set vendor_number = ranked_suppliers.vendor_number
from ranked_suppliers
where suppliers.id = ranked_suppliers.id
  and suppliers.vendor_number is null;

alter table public.suppliers
  alter column vendor_number set not null;

alter table public.suppliers
  add constraint chk_suppliers_vendor_number_range
  check (vendor_number between 1 and 99999999);

alter table public.suppliers
  add constraint uq_suppliers_vendor_number_org unique (org_id, vendor_number);

create index if not exists idx_suppliers_org_vendor_number on public.suppliers (org_id, vendor_number);
