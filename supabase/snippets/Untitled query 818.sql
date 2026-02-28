select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'purchase_orders'
  and column_name = 'currency';
