-- User decision: no review stage in operational tracking. Keep identity/RBAC review metadata unchanged.
create or replace function public.validity_status(d date,v text,kind text default 'term') returns text language sql stable security invoker set search_path='' as $$
 select case when kind='lifetime' then 'Berlaku Seumur Hidup' when d is null then 'Tanggal Belum Diisi'
 when d<(now() at time zone 'Asia/Makassar')::date then 'Kedaluwarsa' when d<=(now() at time zone 'Asia/Makassar')::date+30 then 'Kritis'
 when d<=(now() at time zone 'Asia/Makassar')::date+60 then 'Perhatian' when d<=(now() at time zone 'Asia/Makassar')::date+90 then 'Pantau' else 'Aman' end;
$$;
create or replace view public.equipment_records with(security_invoker=true) as
 select e.*,l.id as latest_calibration_id,l.due_date as latest_due_date,
 case when v.result='tidak_layak' or v.due_date<(now() at time zone 'Asia/Makassar')::date then 'Tidak Layak Pakai'
 when l.id is null then 'Belum Ada Kalibrasi'
 when l.due_date<(now() at time zone 'Asia/Makassar')::date then 'Tidak Layak Pakai'
 when l.due_date is null then 'Tanggal Belum Diisi'
 when l.result is null then 'Hasil Belum Diisi'
 when l.result='layak' then 'Layak Pakai' else 'Tidak Layak Pakai' end as eligibility_status,
 public.validity_status(l.due_date,l.verification_status) as validity_status
 from public.equipment e
 left join lateral(select c.* from public.calibrations c where c.equipment_id=e.id and c.is_active order by c.calibration_date desc nulls last,c.created_at desc,c.id desc limit 1) l on true
 left join lateral(select c.* from public.calibrations c where c.equipment_id=e.id and c.is_active and c.result is not null order by c.calibration_date desc nulls last,c.created_at desc,c.id desc limit 1) v on true;
create or replace view public.renewal_board_records with(security_invoker=true) as
 select c.*,coalesce(o.stage,'uncontacted') as stage,o.id as opportunity_id,c.previous_order_value::text as previous_order_value_text
 from public.client_certificate_records c left join public.renewal_opportunities o on o.certificate_id=c.id
 where c.is_active and c.expiry_date is not null
 and (c.expiry_date<=(now() at time zone 'Asia/Makassar')::date+90 or o.id is not null)
 and not exists(select 1 from public.client_certificates newer where newer.previous_certificate_id=c.id and newer.is_active);
CREATE OR REPLACE FUNCTION public.operational_summary(b text, filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if not private.branch_access(b) then raise exception 'Cabang tidak dapat diakses.' using errcode='42501';end if;
 with visible as(
 select * from public.operational_scope_records r where r.branch_code=b
 and (not r.is_example or filters->>'examples'='true')
 and (nullif(filters->>'category','') is null or filters->>'category'='all' or r.domain=filters->>'category')
 and (nullif(filters->>'validity','') is null or r.validity_status=filters->>'validity')
 and (nullif(filters->>'kind','') is null or exists(select 1 from public.personnel_certificates p where r.domain='personnel' and p.id=r.id and p.validity_kind=filters->>'kind'))
 and (nullif(filters->>'eligibility','') is null or exists(select 1 from public.equipment_records e where r.domain='calibrations' and e.id=r.id and e.eligibility_status=filters->>'eligibility'))
 and (nullif(filters->>'client','') is null or r.client_id::text=filters->>'client')
 and (nullif(filters->>'am','') is null or r.account_manager_id::text=filters->>'am')
 and (nullif(filters->>'area','') is null or r.work_area_id::text=filters->>'area')
 and (nullif(filters->>'type','') is null or r.certificate_type_id::text=filters->>'type')
 and (nullif(filters->>'portfolio','') is null or exists(select 1 from unnest(r.portfolio_ids) p where p::text=filters->>'portfolio'))
 and (nullif(filters->>'from','') is null or r.expiry_date::text>=filters->>'from')
 and (nullif(filters->>'until','') is null or r.expiry_date::text<=filters->>'until')
 ),buckets as(select validity_status,count(*) as total from visible group by validity_status),
 soon as(select * from visible where expiry_date between (now() at time zone 'Asia/Makassar')::date and (now() at time zone 'Asia/Makassar')::date+90 and validity_status not in ('Tanggal Belum Diisi','Berlaku Seumur Hidup') order by expiry_date,id limit 20)
 select jsonb_build_object('records',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from visible order by expiry_date nulls last,id limit 20 offset ((case when filters->>'page' ~ '^[1-9][0-9]{0,4}$' then (filters->>'page')::integer else 1 end)-1)*20)x),'[]'),'total',(select count(*) from visible),'example_count',(select count(*) from visible where is_example),'buckets',coalesce((select jsonb_object_agg(validity_status,total) from buckets),'{}'),
 'soon',coalesce((select jsonb_agg(to_jsonb(soon)) from soon),'[]'),
 'lifetime_count',(select count(*) from visible v join public.personnel_certificates p on p.id=v.id and v.domain='personnel' where p.validity_kind='lifetime'),
 'unfit_equipment_count',(select count(*) from visible v join public.equipment_records e on e.id=v.id and v.domain='calibrations' where e.eligibility_status='Tidak Layak Pakai'),
 'real_client_count',(select count(*) from visible where domain='clients' and not is_example),
 'opportunity',(select sum(previous_order_value)::text from visible where domain='clients' and not is_example and expiry_date between (now() at time zone 'Asia/Makassar')::date and (now() at time zone 'Asia/Makassar')::date+90)) into result;
 return result;
end $function$
