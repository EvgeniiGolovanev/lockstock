alter table public.materials add column target_stock numeric(14,3);
alter table public.materials add constraint material_target_minimum
  check (target_stock is null or target_stock >= min_stock);

-- All relevant writes, including direct Data API writes, serialize with the
-- batch's read/revalidate/write boundary and the existing quota lock.
create function public.lock_replenishment_inputs() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended((case when tg_op='DELETE' then old.org_id else new.org_id end)::text,0));
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function public.lock_replenishment_inputs() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['materials','inventory_balances','suppliers','supplier_materials','purchase_orders','po_lines'] loop
    execute format('create trigger trg_replenishment_lock before insert or update or delete on public.%I for each row execute function public.lock_replenishment_inputs()',t);
  end loop;
end $$;

create table public.replenishment_requests (
  org_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null,
  actor_id uuid not null,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(org_id,request_id)
);
alter table public.replenishment_requests enable row level security;
create policy replenishment_request_read on public.replenishment_requests
  for select to authenticated using(public.is_org_member(org_id));
revoke all on public.replenishment_requests from public,anon,authenticated;
grant select on public.replenishment_requests to authenticated;

create function public.replenishment_rows(p_org_id uuid,p_required_by date,p_timezone text)
returns table(material_id uuid,sku text,name text,uom text,min_stock text,target_stock text,
  on_hand text,confirmed_incoming text,draft_planned text,suggested_order text,
  supplier_id uuid,currency text,unit_price text,orders jsonb,uncertain boolean,draft_warning boolean,state text,snapshot_token text)
language plpgsql stable security invoker set search_path=public as $$
declare v_today date;
begin
  if auth.uid() is null or not public.is_org_member(p_org_id) then
    raise exception using errcode='42501',message='Organization membership required';
  end if;
  if not exists(select 1 from pg_timezone_names tz where tz.name=p_timezone) then
    raise exception using errcode='22023',message='Invalid timezone';
  end if;
  v_today := (now() at time zone p_timezone)::date;
  if p_required_by is null or p_required_by<v_today or p_required_by>v_today+365 then
    raise exception using errcode='22023',message='Planning date must be within the next 365 days';
  end if;
  return query
  with balances as (
    select b.material_id,sum(b.quantity) qty from public.inventory_balances b
    where b.org_id=p_org_id group by b.material_id
  ), supply as (
    select l.material_id,
      coalesce(sum(l.quantity_ordered-l.quantity_received) filter(where po.status in ('sent','partial') and po.expected_at between v_today and p_required_by),0) incoming,
      coalesce(sum(l.quantity_ordered-l.quantity_received) filter(where po.status='draft'),0) planned,
      bool_or(po.status in ('sent','partial') and (po.expected_at is null or po.expected_at<v_today or po.expected_at>p_required_by)) warning,
      bool_or(po.status='draft' and (po.expected_at is null or po.expected_at<v_today or po.expected_at>p_required_by)) draft_warning,
      jsonb_agg(jsonb_build_object('id',po.id,'number',po.po_number,'status',po.status,'expected_at',po.expected_at,
        'remaining',(l.quantity_ordered-l.quantity_received)::numeric(14,3)::text) order by po.id,l.id) linked
    from public.po_lines l join public.purchase_orders po on po.id=l.purchase_order_id and po.org_id=l.org_id
    where l.org_id=p_org_id and po.status in ('draft','sent','partial') and l.quantity_ordered>l.quantity_received
    group by l.material_id
  ), mapping as (
    select sm.material_id,count(*) n,
      (array_agg(sm.supplier_id order by sm.id))[1] sid,
      (array_agg(sm.currency order by sm.id))[1] cur,
      (array_agg(sm.last_price order by sm.id))[1] price
    from public.supplier_materials sm join public.suppliers s on s.id=sm.supplier_id and s.org_id=sm.org_id
    where sm.org_id=p_org_id and sm.preferred and s.is_active group by sm.material_id
  ), base as (
    select m.id,m.sku,m.name,m.uom,m.min_stock minimum,coalesce(m.target_stock,m.min_stock) target,
      coalesce(b.qty,0) physical,coalesce(s.incoming,0) incoming,coalesce(s.planned,0) planned,
      case when mp.n=1 then mp.sid end sid,case when mp.n=1 then mp.cur end cur,
      case when mp.n=1 then mp.price end price,coalesce(s.linked,'[]'::jsonb) linked,coalesce(s.warning,false) warning,coalesce(s.draft_warning,false) draft_warning
    from public.materials m left join balances b on b.material_id=m.id
    left join supply s on s.material_id=m.id left join mapping mp on mp.material_id=m.id
    where m.org_id=p_org_id and m.is_active and coalesce(b.qty,0)<=m.min_stock
  ), calculated as (
    select base.*,greatest(0,target-physical-incoming-planned) suggested from base
  ) select c.id,c.sku,c.name,c.uom,c.minimum::numeric(14,3)::text,c.target::numeric(14,3)::text,
    c.physical::numeric(14,3)::text,c.incoming::numeric(14,3)::text,c.planned::numeric(14,3)::text,c.suggested::numeric(14,3)::text,
    c.sid,c.cur,c.price::text,c.linked,c.warning,c.draft_warning,
    case when c.target=0 then 'setup'
         when c.suggested=0 and c.target>c.physical+c.incoming then 'draft'
         when c.suggested=0 then 'covered'
         when c.sid is null or c.cur not in ('EUR','USD') then 'setup'
         when c.warning then 'review' else 'ready' end,
    md5(jsonb_build_object('data',to_jsonb(c),'required_by',p_required_by,'timezone',p_timezone,'today',v_today)::text)
  from calculated c order by c.sku,c.id;
end $$;
revoke all on function public.replenishment_rows(uuid,date,text) from public,anon;
grant execute on function public.replenishment_rows(uuid,date,text) to authenticated;

create function public.list_replenishment(p_org_id uuid,p_required_by date,p_timezone text,p_state text default 'all',p_page integer default 1,p_limit integer default 50)
returns jsonb language sql stable security invoker set search_path=public as $$
  with all_rows as materialized(select * from public.replenishment_rows(p_org_id,p_required_by,p_timezone)),
  filtered as (select * from all_rows where p_state='all' or state=p_state),
  paged as(select * from filtered order by sku,material_id limit least(100,greatest(1,p_limit)) offset (greatest(1,p_page)-1)*least(100,greatest(1,p_limit))),
  counts as(select state,count(*) n from all_rows group by state)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'::jsonb),
    'total',(select count(*) from filtered),'counts',coalesce((select jsonb_object_agg(state,n) from counts),'{}'::jsonb));
$$;
revoke all on function public.list_replenishment(uuid,date,text,text,integer,integer) from public,anon;
grant execute on function public.list_replenishment(uuid,date,text,text,integer,integer) to authenticated;

create function public.set_replenishment_settings(p_org_id uuid,p_material_id uuid,p_min_stock numeric,p_target_stock numeric,p_supplier_id uuid,p_currency text default 'EUR')
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_org_role_at_least(p_org_id,'manager') or not public.workspace_has_write_access(p_org_id) then
    raise exception using errcode='42501',message='Manager write access required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text,0));
  if p_currency is null or p_currency not in ('EUR','USD') then
    raise exception using errcode='22023',message='Unsupported purchase order currency';
  end if;
  if p_min_stock is null or p_min_stock<0 or p_min_stock<>round(p_min_stock,3) or p_min_stock>=1e11
    or (p_target_stock is not null and (p_target_stock<p_min_stock or p_target_stock<>round(p_target_stock,3) or p_target_stock>=1e11)) then
    raise exception using errcode='22023',message='Target must be at least minimum';
  end if;
  if not exists(select 1 from public.materials where id=p_material_id and org_id=p_org_id and is_active) then
    raise exception using errcode='22023',message='Active material required';
  end if;
  if p_supplier_id is not null and not exists(select 1 from public.suppliers where id=p_supplier_id and org_id=p_org_id and is_active) then
    raise exception using errcode='22023',message='Active supplier required';
  end if;
  update public.materials set min_stock=p_min_stock,target_stock=p_target_stock where id=p_material_id and org_id=p_org_id;
  update public.supplier_materials set preferred=false where org_id=p_org_id and material_id=p_material_id;
  if p_supplier_id is not null then
    insert into public.supplier_materials(org_id,material_id,supplier_id,preferred,currency)
    values(p_org_id,p_material_id,p_supplier_id,true,p_currency)
    on conflict(org_id,supplier_id,material_id) do update set preferred=true,
      last_price=case when supplier_materials.currency=excluded.currency then supplier_materials.last_price else null end,
      currency=excluded.currency;
  end if;
end $$;
revoke all on function public.set_replenishment_settings(uuid,uuid,numeric,numeric,uuid,text) from public,anon;
grant execute on function public.set_replenishment_settings(uuid,uuid,numeric,numeric,uuid,text) to authenticated;

create function public.create_replenishment_drafts(p_org_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_id uuid; v_existing public.replenishment_requests; v_row jsonb; v_current record;
  v_required date; v_zone text; v_orders jsonb:='[]'; v_po jsonb; v_group record;
  v_lines jsonb; v_result jsonb; v_canonical jsonb;
begin
  if auth.uid() is null or not public.is_org_role_at_least(p_org_id,'manager') or not public.workspace_has_write_access(p_org_id) then
    raise exception using errcode='42501',message='Manager write access required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text,0));
  v_id:=(p_payload->>'request_id')::uuid;
  if v_id is null or jsonb_typeof(p_payload->'rows') is distinct from 'array' or jsonb_array_length(p_payload->'rows') not between 1 and 100 then
    raise exception using errcode='22023',message='Select 1 to 100 unique materials';
  end if;
  -- Normalize quantities/prices and row order, so retries do not depend on JSON formatting.
  select p_payload||jsonb_build_object('rows',jsonb_agg(r||jsonb_build_object('quantity',(r->>'quantity')::numeric(14,3)::text,
      'unit_price',case when r->>'unit_price' is not null then (r->>'unit_price')::numeric(14,2)::text else null end) order by r->>'material_id'))
  into v_canonical from jsonb_array_elements(p_payload->'rows') r;
  select * into v_existing from public.replenishment_requests where org_id=p_org_id and request_id=v_id;
  if found then
    -- Business conflicts must not use 40001: older PostgREST versions retry
    -- serialization failures indefinitely instead of returning them to the UI.
    if v_existing.payload<>v_canonical then raise exception using errcode='PT409',message='Request ID already used with different input'; end if;
    return v_existing.result;
  end if;
  v_required:=(p_payload->>'required_by')::date; v_zone:=p_payload->>'timezone';
  if (select count(distinct r->>'material_id') from jsonb_array_elements(p_payload->'rows') r)<>jsonb_array_length(p_payload->'rows') then
    raise exception using errcode='22023',message='Duplicate material selection';
  end if;
  if (select count(*) from (select distinct r->>'supplier_id',r->>'currency' from jsonb_array_elements(p_payload->'rows') r) g)>20 then
    raise exception using errcode='22023',message='Maximum 20 order groups';
  end if;
  for v_row in select value from jsonb_array_elements(p_payload->'rows') loop
    select * into v_current from public.replenishment_rows(p_org_id,v_required,v_zone) where material_id=(v_row->>'material_id')::uuid;
    if not found or v_current.snapshot_token is distinct from v_row->>'snapshot_token' then
      raise exception using errcode='PT409',message='Recommendations changed; review again';
    end if;
    if v_row->>'quantity' is null or (v_row->>'quantity') !~ '^\d{1,11}(\.\d{1,3})?$'
      or (v_row->>'quantity')::numeric<=0 or (v_row->>'quantity')::numeric>v_current.suggested_order::numeric then
      raise exception using errcode='22023',message='Quantity must be positive and no greater than recommendation';
    end if;
    if v_row->>'currency' is null or v_row->>'currency' not in ('EUR','USD') or v_row->>'supplier_id' is null
      or not exists(select 1 from public.suppliers where id=(v_row->>'supplier_id')::uuid and org_id=p_org_id and is_active) then
      raise exception using errcode='22023',message='Active supplier and currency required';
    end if;
    if v_row->>'unit_price' is not null and ((v_row->>'unit_price') !~ '^\d{1,12}(\.\d{1,2})?$' or (v_row->>'unit_price')::numeric>=1e12) then
      raise exception using errcode='22023',message='Invalid unit price';
    end if;
    if v_current.uncertain and coalesce((v_row->>'acknowledge_incoming')::boolean,false)=false then
      raise exception using errcode='22023',message='Review uncertain incoming orders';
    end if;
    if v_row->>'expected_at' is not null and (v_row->>'expected_at')::date<(now() at time zone v_zone)::date then
      raise exception using errcode='22023',message='Expected date cannot be in the past';
    end if;
  end loop;
  for v_group in select r->>'supplier_id' sid,r->>'currency' cur,
    count(distinct coalesce(r->>'expected_at','')) dates,min(r->>'expected_at') expected,
    jsonb_agg(jsonb_build_object('material_id',r->>'material_id','quantity_ordered',(r->>'quantity')::numeric,
      'unit_price',(r->>'unit_price')::numeric) order by r->>'material_id') lines
    from jsonb_array_elements(p_payload->'rows') r group by r->>'supplier_id',r->>'currency' order by 1,2
  loop
    if v_group.dates<>1 then raise exception using errcode='22023',message='Use one expected date per supplier and currency'; end if;
    v_lines:=v_group.lines;
    v_po:=public.create_purchase_order_with_lines(p_org_id,v_group.sid::uuid,'PO-'||gen_random_uuid()::text,v_group.cur,v_lines,v_group.expected::date,'Replenishment request '||v_id::text);
    v_orders:=v_orders||jsonb_build_array(jsonb_build_object('id',v_po->>'id','po_number',v_po->>'po_number','supplier_id',v_group.sid,'currency',v_group.cur,'status','draft'));
  end loop;
  v_result:=jsonb_build_object('request_id',v_id,'orders',v_orders);
  insert into public.replenishment_requests(org_id,request_id,actor_id,payload,result) values(p_org_id,v_id,auth.uid(),v_canonical,v_result);
  return v_result;
end $$;
revoke all on function public.create_replenishment_drafts(uuid,jsonb) from public,anon;
grant execute on function public.create_replenishment_drafts(uuid,jsonb) to authenticated;

create function public.get_replenishment_result(p_org_id uuid,p_request_id uuid)
returns jsonb language sql stable security invoker set search_path=public as $$
  select result from public.replenishment_requests where org_id=p_org_id and request_id=p_request_id;
$$;
revoke all on function public.get_replenishment_result(uuid,uuid) from public,anon;
grant execute on function public.get_replenishment_result(uuid,uuid) to authenticated;
