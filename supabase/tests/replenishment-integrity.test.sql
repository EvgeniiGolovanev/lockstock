begin;
create extension if not exists pgtap with schema extensions;
select plan(12);
insert into public.organizations(id,name) values ('fa100000-0000-4000-8000-000000000001','Replenishment integrity');
insert into public.organization_billing(org_id,plan,status,billing_interval) values ('fa100000-0000-4000-8000-000000000001','operations','active','monthly');
insert into public.org_users(org_id,user_id,role) values ('fa100000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001','owner');
insert into public.suppliers(id,org_id,name) values
('fa500000-0000-4000-8000-000000000001','fa100000-0000-4000-8000-000000000001','First'),
('fa500000-0000-4000-8000-000000000002','fa100000-0000-4000-8000-000000000001','Second');
insert into public.materials(id,org_id,sku,name,min_stock,target_stock)
select ('fa300000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'fa100000-0000-4000-8000-000000000001','INT-'||n,'Material '||n,10,50 from generate_series(1,3) n;
insert into public.locations(id,org_id,name) values
('fa400000-0000-4000-8000-000000000001','fa100000-0000-4000-8000-000000000001','First'),
('fa400000-0000-4000-8000-000000000002','fa100000-0000-4000-8000-000000000001','Second');
insert into public.inventory_balances(org_id,material_id,location_id,quantity)
select org_id,id,'fa400000-0000-4000-8000-000000000001',8 from public.materials where org_id='fa100000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"fa200000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.set_replenishment_settings(org_id,id,10,50,case when sku='INT-1' then 'fa500000-0000-4000-8000-000000000001' else 'fa500000-0000-4000-8000-000000000002' end::uuid)
from public.materials where org_id='fa100000-0000-4000-8000-000000000001';
create temporary table integrity_payload as select jsonb_build_object('request_id','fa600000-0000-4000-8000-000000000001','required_by',current_date+14,'timezone','UTC','rows',jsonb_agg(jsonb_build_object('material_id',material_id,'supplier_id',supplier_id,'snapshot_token',snapshot_token,'currency','EUR','quantity','42','expected_at',current_date+case when sku='INT-3' then 3 else 2 end))) payload
from public.replenishment_rows('fa100000-0000-4000-8000-000000000001',current_date+14,'UTC');
select throws_ok($$select public.create_replenishment_drafts('fa100000-0000-4000-8000-000000000001',payload) from integrity_payload$$,'22023','Use one expected date per supplier and currency','second group failure aborts the batch');
select is((select count(*) from public.purchase_orders where org_id='fa100000-0000-4000-8000-000000000001'),0::bigint,'first group is rolled back');
select is((select count(*) from public.replenishment_requests where org_id='fa100000-0000-4000-8000-000000000001'),0::bigint,'failed request does not reserve its key');
update integrity_payload set payload=jsonb_set(payload,'{rows}',(select jsonb_agg(jsonb_set(r,'{expected_at}',to_jsonb((current_date+2)::text))) from jsonb_array_elements(payload->'rows') r));
select public.create_replenishment_drafts('fa100000-0000-4000-8000-000000000001',payload) from integrity_payload;
select is((select count(*) from public.purchase_orders where org_id='fa100000-0000-4000-8000-000000000001'),2::bigint,'one ordinary draft per supplier');
select is((select count(distinct po_number) from public.purchase_orders where org_id='fa100000-0000-4000-8000-000000000001'),2::bigint,'batch numbers are unique');
select public.transition_purchase_order_status(org_id,id,'cancelled') from public.purchase_orders where org_id='fa100000-0000-4000-8000-000000000001';
create temporary table integrity_incoming as select public.create_purchase_order_with_lines('fa100000-0000-4000-8000-000000000001','fa500000-0000-4000-8000-000000000001','INTEGRITY-INCOMING','EUR','[{"material_id":"fa300000-0000-4000-8000-000000000001","quantity_ordered":30}]',current_date+2) po;
select public.transition_purchase_order_status('fa100000-0000-4000-8000-000000000001',(select (po->>'id')::uuid from integrity_incoming),'sent');
select is((select suggested_order from public.replenishment_rows('fa100000-0000-4000-8000-000000000001',current_date+14,'UTC') where sku='INT-1'),'12.000','incoming thirty reduces forty-two to twelve');
select public.receive_purchase_order('fa100000-0000-4000-8000-000000000001',(select (po->>'id')::uuid from integrity_incoming),'fa200000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_build_object('po_line_id',(select id from public.po_lines where purchase_order_id=(select (po->>'id')::uuid from integrity_incoming)),'quantity_received',1,'location_id','fa400000-0000-4000-8000-000000000002')));
select is((select on_hand from public.replenishment_rows('fa100000-0000-4000-8000-000000000001',current_date+14,'UTC') where sku='INT-1'),'9.000','receipt adds physical quantity across locations once');
select is((select confirmed_incoming from public.replenishment_rows('fa100000-0000-4000-8000-000000000001',current_date+14,'UTC') where sku='INT-1'),'29.000','partial receipt reduces remaining incoming once');
select is((select suggested_order from public.replenishment_rows('fa100000-0000-4000-8000-000000000001',current_date+14,'UTC') where sku='INT-1'),'12.000','partial receipt does not double count coverage');
reset role;
update public.materials set target_stock=200 where id='fa300000-0000-4000-8000-000000000001';
insert into public.purchase_orders(org_id,supplier_id,po_number,currency,status,expected_at)
select 'fa100000-0000-4000-8000-000000000001','fa500000-0000-4000-8000-000000000001','INTEGRITY-MANY-'||n,'EUR','sent',current_date+2 from generate_series(1,101) n;
insert into public.po_lines(org_id,purchase_order_id,material_id,quantity_ordered)
select org_id,id,'fa300000-0000-4000-8000-000000000001',1 from public.purchase_orders where org_id='fa100000-0000-4000-8000-000000000001' and po_number like 'INTEGRITY-MANY-%';
set local role authenticated;
select is((select confirmed_incoming from public.replenishment_rows('fa100000-0000-4000-8000-000000000001',current_date+14,'UTC') where sku='INT-1'),'130.000','all orders beyond first hundred contribute');
select is((select on_hand from public.replenishment_rows('fa100000-0000-4000-8000-000000000001',current_date+14,'UTC') where sku='INT-1'),'9.000','many PO lines do not multiply physical balances');
select is((select suggested_order from public.replenishment_rows('fa100000-0000-4000-8000-000000000001',current_date+14,'UTC') where sku='INT-1'),'61.000','full data aggregation uses independent balances and supply');
select * from finish();
rollback;
