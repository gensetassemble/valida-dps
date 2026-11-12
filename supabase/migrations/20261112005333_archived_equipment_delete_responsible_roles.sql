create function private.archived_equipment_delete_scope(b text,e uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select private.has_role(b,array['super_admin'])
 or (private.has_role(b,array['equipment_manager','coordinator']) and private.equipment_scope(b,e,true));
$$;
revoke all on function private.archived_equipment_delete_scope(text,uuid) from public,anon;
grant execute on function private.archived_equipment_delete_scope(text,uuid) to authenticated;
create or replace function private.guard_archived_equipment_delete() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not private.archived_equipment_delete_scope(old.branch_code,old.id) then
  raise exception 'Hapus permanen hanya untuk Super Admin, PTK, atau Koordinator portofolio terkait.' using errcode='42501';
 end if;
 if old.is_active then
  raise exception 'Pindahkan alat ke Arsip terlebih dahulu.' using errcode='P0001';
 end if;
 -- Bundle membership and document links are not all backed by foreign keys.
 -- Serialize their writes while checking them, including rows hidden by RLS.
 lock table public.calibration_requests, public.operational_documents in share row exclusive mode;
 if exists(select 1 from public.calibrations where equipment_id=old.id)
 or exists(select 1 from public.calibration_requests where equipment_id=old.id or old.id=any(equipment_ids))
 or exists(select 1 from public.operational_documents where domain='calibration' and record_id=old.id) then
  raise exception 'Alat masih memiliki riwayat kalibrasi, pengajuan UMA, atau dokumen. Tetap simpan di Arsip agar riwayat tidak hilang.' using errcode='P0001';
 end if;
 return old;
end $$;
revoke all on function private.guard_archived_equipment_delete() from public,anon,authenticated;

drop policy equipment_delete_archived_super_admin on public.equipment;
create policy equipment_delete_archived_responsible on public.equipment for delete to authenticated
using(not is_active and private.archived_equipment_delete_scope(branch_code,id));

