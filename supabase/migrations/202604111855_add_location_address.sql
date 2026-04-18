alter table public.locations
  add column if not exists address text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_locations_address_length'
  ) then
    alter table public.locations
      add constraint chk_locations_address_length
      check (address is null or char_length(address) <= 265);
  end if;
end
$$;
