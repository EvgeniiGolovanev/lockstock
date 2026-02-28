alter table public.purchase_orders
  add column if not exists currency text not null default 'EUR';

alter table public.purchase_orders
  drop constraint if exists purchase_orders_currency_check;

alter table public.purchase_orders
  add constraint purchase_orders_currency_check check (currency in ('EUR', 'USD'));
