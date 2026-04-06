alter table public.materials
  add column if not exists category text,
  add column if not exists subcategory text;
