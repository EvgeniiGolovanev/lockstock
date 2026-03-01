alter table public.purchase_orders
  add column if not exists currency text;

alter table public.purchase_orders
  alter column currency set default 'EUR';

update public.purchase_orders
set currency = 'EUR'
where currency is null
   or currency not in ('EUR', 'USD');

alter table public.purchase_orders
  drop constraint if exists purchase_orders_currency_check;

alter table public.purchase_orders
  add constraint purchase_orders_currency_check check (currency in ('EUR', 'USD'));

alter table public.purchase_orders
  alter column currency set not null;
