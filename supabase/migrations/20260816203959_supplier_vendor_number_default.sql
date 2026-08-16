alter table public.suppliers
  alter column vendor_number set default 0;

create or replace function public.assign_supplier_vendor_number()
returns trigger
language plpgsql
as $$
declare
  next_vendor_number integer;
begin
  if new.vendor_number is not null and new.vendor_number <> 0 then
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
