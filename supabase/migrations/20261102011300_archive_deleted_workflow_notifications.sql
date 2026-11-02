-- Archive inbox entries by exact workflow event, retaining notification and audit records.
alter table public.user_notifications
 add column archived_at timestamptz,
 add column archive_reason text,
 add constraint notification_archive_pair check ((archived_at is null)=(archive_reason is null));
create index notifications_active_inbox on public.user_notifications(profile_id,read_at,created_at desc) where archived_at is null;

-- Internal trigger only: the existing workflow guards authorize the history reset.
-- Definer is needed to archive all recipients, not just the acting user's inbox.
create function private.archive_workflow_notifications() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.history_deleted_at is null or old.history_deleted_at is not null then return new;end if;
 if tg_table_name='personnel_renewal_cases' then
  update public.user_notifications n set archived_at=new.history_deleted_at,archive_reason='workflow_history_deleted'
  from public.personnel_renewal_events e where e.case_id=new.id and e.branch_code=new.branch_code
   and n.event_id=e.id and n.branch_code=e.branch_code and n.archived_at is null;
 elsif tg_table_name='calibration_requests' then
  update public.user_notifications n set archived_at=new.history_deleted_at,archive_reason='workflow_history_deleted'
  from public.calibration_request_events e where e.request_id=new.id and e.branch_code=new.branch_code
   and n.event_id=e.id and n.branch_code=e.branch_code and n.archived_at is null;
 end if;
 return new;
end $$;
revoke all on function private.archive_workflow_notifications() from public,anon,authenticated;
create trigger archive_workflow_notifications after update of history_deleted_at on public.personnel_renewal_cases
 for each row execute function private.archive_workflow_notifications();
create trigger archive_workflow_notifications after update of history_deleted_at on public.calibration_requests
 for each row execute function private.archive_workflow_notifications();

-- Also covers late event delivery for an already archived process.
create function private.archive_closed_workflow_delivery() returns trigger
language plpgsql security definer set search_path='' as $$
declare archived timestamptz;
begin
 select w.history_deleted_at into archived from public.personnel_renewal_events e
 join public.personnel_renewal_cases w on w.id=e.case_id and w.branch_code=e.branch_code
 where e.id=new.event_id and e.branch_code=new.branch_code and w.history_deleted_at is not null;
 if archived is null then
  select w.history_deleted_at into archived from public.calibration_request_events e
  join public.calibration_requests w on w.id=e.request_id and w.branch_code=e.branch_code
  where e.id=new.event_id and e.branch_code=new.branch_code and w.history_deleted_at is not null;
 end if;
 if archived is not null then new.archived_at:=archived;new.archive_reason:='workflow_history_deleted';end if;
 return new;
end $$;
revoke all on function private.archive_closed_workflow_delivery() from public,anon,authenticated;
create trigger archive_closed_workflow_delivery before insert on public.user_notifications
 for each row execute function private.archive_closed_workflow_delivery();

-- Reconcile existing testing resets; keep title, destination, read state, events and source audits.
update public.user_notifications n set archived_at=w.history_deleted_at,archive_reason='workflow_history_deleted'
from public.personnel_renewal_events e join public.personnel_renewal_cases w on w.id=e.case_id and w.branch_code=e.branch_code
where n.event_id=e.id and n.branch_code=e.branch_code and w.history_deleted_at is not null and n.archived_at is null;
update public.user_notifications n set archived_at=w.history_deleted_at,archive_reason='workflow_history_deleted'
from public.calibration_request_events e join public.calibration_requests w on w.id=e.request_id and w.branch_code=e.branch_code
where n.event_id=e.id and n.branch_code=e.branch_code and w.history_deleted_at is not null and n.archived_at is null;

-- Keep projection columns/order stable for deployed clients. All source RLS still applies.
create or replace view public.notification_inbox_records with(security_invoker=true) as
select n.id,n.branch_code,n.profile_id,n.event_id,n.title,n.href,n.read_at,n.created_at,n.updated_at,
 case when n.href like '/kompetensi-personil/%' then 'personnel' when n.href like '/kalibrasi-alat/%' then 'calibrations' when n.href like '/sertifikat-klien/%' then 'clients' else 'system' end as category,
 ctx.value->>'event_status' as event_status,ctx.value->>'context_name' as context_name,ctx.value->>'entity_title' as entity_title,
 ctx.value->>'reference_number' as reference_number,ctx.value->>'replacement_certificate_number' as replacement_certificate_number,
 ctx.value->>'portfolio_code' as portfolio_code,(ctx.value->>'expires_on')::date as expires_on,
 ctx.value->>'event_notes' as event_notes,ctx.value->>'activity_group_id' as activity_group_id,
 ctx.value->>'target_href' as target_href,coalesce((ctx.value->>'process_reset')::boolean,false) as process_reset,
 concat_ws(' ',n.title,ctx.value->>'context_name',ctx.value->>'entity_title',ctx.value->>'reference_number',ctx.value->>'replacement_certificate_number',ctx.value->>'portfolio_code') as search_text
from public.user_notifications n
cross join lateral (select private.notification_inbox_context(n.id) as value offset 0) ctx
where n.archived_at is null;
