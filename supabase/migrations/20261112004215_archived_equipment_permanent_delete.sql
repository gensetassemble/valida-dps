-- Permanent deletion is restricted to archived, unreferenced equipment.
-- No existing equipment is modified by this migration. The existing DELETE audit remains.
create function private.guard_archived_equipment_delete() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(old.branch_code,array['super_admin']) then
  raise exception 'Hapus permanen hanya untuk Super Admin dengan MFA.' using errcode='42501';
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
create trigger guard_archived_equipment_delete before delete on public.equipment
for each row execute function private.guard_archived_equipment_delete();
grant delete on public.equipment to authenticated;
create policy equipment_delete_archived_super_admin on public.equipment for delete to authenticated
using(not is_active and private.has_role(branch_code,array['super_admin']));
