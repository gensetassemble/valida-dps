-- Additive read-only inbox projection. Invoker context lookups preserve each source table's RLS.
-- Domain lookups run separately to avoid expanding all domain policies in a single join tree.
create function private.notification_inbox_context(notification uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare n public.user_notifications; route uuid; work jsonb; cert jsonb; equipment jsonb; client_certificate jsonb;
 person_name text; type_name text; client_name text; portfolio_code text; replacement_number text; target text;
begin
 if auth.uid() is null then return '{}'::jsonb;end if;
 select * into n from public.user_notifications x where x.id=notification and x.profile_id=auth.uid();
 if n.id is null then return '{}'::jsonb;end if;
 route:=substring(n.href from '^/[^/]+/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})')::uuid;
 if n.href like '/kompetensi-personil/%' then
  select to_jsonb(w)||jsonb_build_object('event_status',ev.new_status,'event_notes',ev.notes) into work
   from public.personnel_renewal_events ev join public.personnel_renewal_cases w on w.id=ev.case_id and w.branch_code=ev.branch_code where ev.id=n.event_id and ev.branch_code=n.branch_code;
  select to_jsonb(c) into cert from public.personnel_certificates c where c.id=coalesce((work->>'certificate_id')::uuid,route) and c.branch_code=n.branch_code;
  if cert is not null then
   select d.full_name into person_name from public.employee_directory d where d.id=(cert->>'employee_id')::uuid and d.branch_code=n.branch_code;
   select t.name into type_name from public.certificate_types t where t.id=(cert->>'certificate_type_id')::uuid and t.branch_code=n.branch_code;
   if work->>'event_status'='renewed' then
    select r.certificate_number into replacement_number from public.personnel_certificates r where r.id=(work->>'replacement_certificate_id')::uuid and r.branch_code=n.branch_code;
   end if;
   target:='/kompetensi-personil/'||case when work->>'event_status'='renewed' and work->>'history_deleted_at' is null then coalesce(work->>'replacement_certificate_id',cert->>'id') else cert->>'id' end||'?branch='||n.branch_code;
  end if;
  return jsonb_build_object('context_name',person_name,'entity_title',coalesce(nullif(cert->>'original_title',''),type_name),
   'reference_number',cert->>'certificate_number','replacement_certificate_number',replacement_number,'expires_on',cert->>'expiry_date',
   'event_status',work->>'event_status','event_notes',work->>'event_notes','activity_group_id',case when work->>'id' is not null then 'personnel:'||(work->>'id') end,
   'process_reset',work->>'history_deleted_at' is not null,'target_href',target);
 elsif n.href like '/kalibrasi-alat/%' then
  select to_jsonb(r)||jsonb_build_object('event_status',ev.new_status,'event_notes',ev.notes) into work
   from public.calibration_request_events ev join public.calibration_requests r on r.id=ev.request_id and r.branch_code=ev.branch_code where ev.id=n.event_id and ev.branch_code=n.branch_code;
  select to_jsonb(e) into equipment from public.equipment e where e.id=coalesce((work->>'equipment_id')::uuid,route) and e.branch_code=n.branch_code;
  if equipment is not null then
   select p.code into portfolio_code from public.portfolios p where p.id=(equipment->>'portfolio_id')::uuid and p.branch_code=n.branch_code;
   target:='/kalibrasi-alat/'||(equipment->>'id')||'?branch='||n.branch_code;
  end if;
  return jsonb_build_object('context_name',equipment->>'name','entity_title',equipment->>'name','reference_number',equipment->>'tag','portfolio_code',portfolio_code,
   'event_status',work->>'event_status','event_notes',work->>'event_notes','activity_group_id',case when work->>'id' is not null then 'calibrations:'||(work->>'id') end,'target_href',target);
 elsif n.href like '/sertifikat-klien/%' then
  select to_jsonb(c) into client_certificate from public.client_certificates c where c.id=route and c.branch_code=n.branch_code;
  if client_certificate is not null then
   select c.name into client_name from public.clients c where c.id=(client_certificate->>'client_id')::uuid and c.branch_code=n.branch_code;
   select t.name into type_name from public.certificate_types t where t.id=(client_certificate->>'certificate_type_id')::uuid and t.branch_code=n.branch_code;
   target:='/sertifikat-klien/'||route::text||'?branch='||n.branch_code;
  end if;
  return jsonb_build_object('context_name',client_name,'entity_title',type_name,'reference_number',client_certificate->>'certificate_number','expires_on',client_certificate->>'expiry_date','target_href',target);
 end if;
 return jsonb_build_object('target_href',case when n.href like '/dashboard%' or n.href like '/notifikasi%' then n.href end);
end $$;
revoke all on function private.notification_inbox_context(uuid) from public,anon;
grant execute on function private.notification_inbox_context(uuid) to authenticated;

create view public.notification_inbox_records with(security_invoker=true) as
select n.*,
 case when n.href like '/kompetensi-personil/%' then 'personnel' when n.href like '/kalibrasi-alat/%' then 'calibrations' when n.href like '/sertifikat-klien/%' then 'clients' else 'system' end as category,
 ctx.value->>'event_status' as event_status,ctx.value->>'context_name' as context_name,ctx.value->>'entity_title' as entity_title,
 ctx.value->>'reference_number' as reference_number,ctx.value->>'replacement_certificate_number' as replacement_certificate_number,
 ctx.value->>'portfolio_code' as portfolio_code,(ctx.value->>'expires_on')::date as expires_on,
 ctx.value->>'event_notes' as event_notes,ctx.value->>'activity_group_id' as activity_group_id,
 ctx.value->>'target_href' as target_href,coalesce((ctx.value->>'process_reset')::boolean,false) as process_reset,
 concat_ws(' ',n.title,ctx.value->>'context_name',ctx.value->>'entity_title',ctx.value->>'reference_number',ctx.value->>'replacement_certificate_number',ctx.value->>'portfolio_code') as search_text
from public.user_notifications n
cross join lateral (select private.notification_inbox_context(n.id) as value offset 0) ctx;
revoke all on public.notification_inbox_records from public,anon;
grant select on public.notification_inbox_records to authenticated;
