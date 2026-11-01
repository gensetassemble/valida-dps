create or replace view public.personnel_certificate_portfolios with(security_invoker=true) as
select c.*,array(select distinct a.portfolio_id from public.employee_portfolio_assignments a
 where a.employee_id=c.employee_id and a.branch_code=c.branch_code and a.is_active and a.verification_status='verified'
 and a.effective_from<=(now() at time zone 'Asia/Makassar')::date and (a.effective_until is null or a.effective_until>=(now() at time zone 'Asia/Makassar')::date)) as portfolio_ids,
 coalesce(own.status,prior.status,'unprocessed') as renewal_status,
 case when own.status='renewed' then own.replacement_certificate_id end as superseded_by_certificate_id,
 prior.certificate_id as previous_certificate_id
from public.personnel_certificate_records c
left join public.personnel_renewal_cases own on own.certificate_id=c.id and own.branch_code=c.branch_code
left join public.personnel_renewal_cases prior on prior.replacement_certificate_id=c.id and prior.branch_code=c.branch_code and prior.status='renewed';

-- Existing notifications obtain context through the recipient's own RLS; no recipients or permissions change.
create view public.user_notification_details with(security_invoker=true) as
select n.*,
 case when ev.id is not null and c.id is not null then
  coalesce(e.full_name,'Pegawai')||' · '||coalesce(nullif(c.original_title,''),t.name,'Lisensi')||' · No. '||coalesce(c.certificate_number,'Belum diisi')||' · '||
  case ev.new_status when 'renewed' then 'Sudah Diperpanjang' when 'processing' then 'Sedang Diproses' else 'Belum Diproses' end
 else n.title end as display_title,
 case when ev.new_status='renewed' and latest.id is not null then '/kompetensi-personil/'||latest.id::text||'?branch='||n.branch_code else n.href end as display_href,
 case when ev.new_status='renewed' then latest.certificate_number end as replacement_certificate_number
from public.user_notifications n
left join public.personnel_renewal_events ev on ev.id=n.event_id and ev.branch_code=n.branch_code
left join public.personnel_renewal_cases w on w.id=ev.case_id and w.branch_code=n.branch_code
left join public.personnel_certificates c on c.id=w.certificate_id and c.branch_code=n.branch_code
left join public.employee_directory e on e.id=c.employee_id and e.branch_code=n.branch_code
left join public.certificate_types t on t.id=c.certificate_type_id and t.branch_code=n.branch_code
left join public.personnel_certificates latest on latest.id=w.replacement_certificate_id and latest.branch_code=n.branch_code;
revoke all on public.user_notification_details from public,anon;
grant select on public.user_notification_details to authenticated;

create or replace view public.operational_scope_records with(security_invoker=true) as
 select 'clients'::text as domain,c.id,c.branch_code,c.client_name as entity_name,c.certificate_number as title,c.expiry_date,c.validity_status,c.verification_status,c.previous_order_value,c.client_id,c.account_manager_id,c.work_area_id,array[c.scope_portfolio_id] as portfolio_ids,c.certificate_type_id,c.is_example
 from public.client_certificate_records c where c.is_active
 union all
 select 'personnel',c.id,c.branch_code,c.employee_name,c.original_title,c.expiry_date,c.validity_status,c.verification_status,null::numeric,null::uuid,null::uuid,null::uuid,c.portfolio_ids,c.certificate_type_id,false from public.personnel_certificate_portfolios c where c.is_active and c.superseded_by_certificate_id is null
 union all
 select 'calibrations',e.id,e.branch_code,e.name,e.tag,e.latest_due_date,e.validity_status,e.verification_status,null::numeric,e.client_id,null::uuid,null::uuid,array[e.portfolio_id],null::uuid,false from public.equipment_records e where e.is_active;
