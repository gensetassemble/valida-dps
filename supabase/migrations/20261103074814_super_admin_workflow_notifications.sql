-- Super Admin monitors branch workflows, while each user keeps their own inbox
-- and read state. Do not broaden SELECT/UPDATE policies to other recipients.
do $$
declare definition text; needle text;
begin
 definition:=pg_get_functiondef('private.record_simple_calibration_event()'::regprocedure);
 needle:='(p.id=new.created_by and private.target_has_role(p.id,new.branch_code,''coordinator'')) or';
 if position(needle in definition)=0 then
  raise exception 'Calibration recipient definition changed; review required.';
 end if;
 execute replace(definition,needle,
  'private.target_has_role(p.id,new.branch_code,''super_admin'') or '||needle);
end $$;

-- Restore only missing deliveries for the latest event of retained requests.
-- Deleted histories remain archived; original timestamps and events are retained.
insert into public.user_notifications(branch_code,profile_id,event_id,title,href,created_at)
select r.branch_code,p.id,ev.id,
 'Permintaan alat: '||case ev.new_status
  when 'submitted' then 'Sedang Diajukan' when 'accepted' then 'Sedang Diproses'
  when 'completed' then 'Selesai' when 'cancelled' then 'Dibatalkan'
  else ev.new_status end,
 '/kalibrasi-alat/'||r.equipment_id::text||'?branch='||r.branch_code,ev.created_at
from public.calibration_requests r
cross join lateral (
 select e.id,e.new_status,e.created_at from public.calibration_request_events e
 where e.request_id=r.id and e.branch_code=r.branch_code
 order by e.created_at desc,e.id desc limit 1
) ev
join public.profiles p on private.target_has_role(p.id,r.branch_code,'super_admin')
where r.history_deleted_at is null
on conflict(profile_id,event_id) do nothing;
