create or replace function public.operational_summary(b text,filters jsonb default '{}') returns jsonb language plpgsql stable security invoker set search_path='' as $$
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
 soon as(select * from visible where expiry_date between (now() at time zone 'Asia/Makassar')::date and (now() at time zone 'Asia/Makassar')::date+90 and validity_status not in ('Perlu Verifikasi','Berlaku Seumur Hidup') order by expiry_date,id limit 20)
 select jsonb_build_object('records',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from visible order by expiry_date nulls last,id limit 20 offset ((case when filters->>'page' ~ '^[1-9][0-9]{0,4}$' then (filters->>'page')::integer else 1 end)-1)*20)x),'[]'),'total',(select count(*) from visible),'example_count',(select count(*) from visible where is_example),'buckets',coalesce((select jsonb_object_agg(validity_status,total) from buckets),'{}'),
 'soon',coalesce((select jsonb_agg(to_jsonb(soon)) from soon),'[]'),
 'lifetime_count',(select count(*) from visible v join public.personnel_certificates p on p.id=v.id and v.domain='personnel' where p.validity_kind='lifetime'),
 'unfit_equipment_count',(select count(*) from visible v join public.equipment_records e on e.id=v.id and v.domain='calibrations' where e.eligibility_status='Tidak Layak Pakai'),
 'real_client_count',(select count(*) from visible where domain='clients' and not is_example),
 'opportunity',(select sum(previous_order_value)::text from visible where domain='clients' and not is_example and verification_status='verified' and expiry_date between (now() at time zone 'Asia/Makassar')::date and (now() at time zone 'Asia/Makassar')::date+90)) into result;
 return result;
end $$;
