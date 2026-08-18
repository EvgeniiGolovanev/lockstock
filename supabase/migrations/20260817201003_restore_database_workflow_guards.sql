-- Keep purchase-order workflow transitions behind their guarded RPCs. Table
-- privileges are column-specific; SECURITY DEFINER RPCs continue to own the
-- status and receipt-accounting columns.
revoke update on public.purchase_orders, public.po_lines from authenticated;
grant update (supplier_id, po_number, expected_at, notes) on public.purchase_orders to authenticated;
grant update (quantity_ordered, unit_price) on public.po_lines to authenticated;
