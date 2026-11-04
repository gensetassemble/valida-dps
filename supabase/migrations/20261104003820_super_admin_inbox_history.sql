-- A newly assigned Super Admin receives the latest retained workflow activity
-- in their own inbox. Read state and archived/deleted histories stay untouched.
create function private.backfill_super_admin_inbox(recipient uuid,b text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.target_has_role(recipient,b,'super_admin') then return;end if;
 insert into public.user_notifications(branch_code,profile_id,event_id,title,href,created_at)
 select w.branch_code,recipient,e.id,
  'Permintaan alat: '||case e.new_status when 'submitted' then 'Sedang Diajukan'
   when 'accepted' then 'Sedang Diproses' when 'completed' then 'Selesai'
   when 'cancelled' then 'Dibatalkan' else e.new_status end,
  '/kalibrasi-alat/'||w.equipment_id::text||'?branch='||b,e.created_at
 from public.calibration_requests w
 cross join lateral (select ev.id,ev.new_status,ev.created_at
  from public.calibration_request_events ev where ev.request_id=w.id and ev.branch_code=b
  order by ev.created_at desc,ev.id desc limit 1) e
 where w.branch_code=b and w.history_deleted_at is null
 on conflict(profile_id,event_id) do nothing;

 insert into public.user_notifications(branch_code,profile_id,event_id,title,href,created_at)
 select w.branch_code,recipient,e.id,
  'Status perpanjangan sertifikat: '||case e.new_status when 'processing' then 'Sedang Diproses'
   when 'renewed' then 'Sudah Diperpanjang' when 'cancelled' then 'Dibatalkan' else 'Belum Diproses' end,
  '/kompetensi-personil/'||w.certificate_id::text||'?branch='||b,e.created_at
 from public.personnel_renewal_cases w
 cross join lateral (select ev.id,ev.new_status,ev.created_at
  from public.personnel_renewal_events ev where ev.case_id=w.id and ev.branch_code=b
  order by ev.created_at desc,ev.id desc limit 1) e
 where w.branch_code=b and w.history_deleted_at is null
 on conflict(profile_id,event_id) do nothing;
end $$;
revoke all on function private.backfill_super_admin_inbox(uuid,text) from public,anon,authenticated;

create function private.sync_super_admin_inbox() returns trigger
language plpgsql security definer set search_path='' as $$
declare b text;
begin
 if tg_table_name='user_role_assignments' then
  if new.role_code='super_admin' and new.is_active and new.revoked_at is null then
   perform private.backfill_super_admin_inbox(new.profile_id,new.branch_code);
  end if;
 elsif new.is_active and not old.is_active then
  for b in select a.branch_code from public.user_role_assignments a
   where a.profile_id=new.id and a.role_code='super_admin' and a.is_active and a.revoked_at is null
  loop perform private.backfill_super_admin_inbox(new.id,b);end loop;
 end if;
 return new;
end $$;
revoke all on function private.sync_super_admin_inbox() from public,anon,authenticated;
create trigger sync_super_admin_inbox after insert or update on public.user_role_assignments
 for each row execute function private.sync_super_admin_inbox();
create trigger sync_super_admin_inbox after update of is_active on public.profiles
 for each row execute function private.sync_super_admin_inbox();

-- Reconcile existing official administrators without overwriting any inbox entry.
do $$declare a record;begin
 for a in select distinct g.profile_id,g.branch_code from public.user_role_assignments g
  where g.role_code='super_admin' and g.is_active and g.revoked_at is null
 loop perform private.backfill_super_admin_inbox(a.profile_id,a.branch_code);end loop;
end $$;
