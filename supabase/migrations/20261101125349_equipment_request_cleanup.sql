-- Hide closed testing requests without deleting equipment, calibration results, events or audit records.
alter table public.calibration_requests
 add column history_deleted_at timestamptz,
 add column history_deleted_by uuid references public.profiles(id),
 add constraint calibration_request_history_deletion_pair check ((history_deleted_at is null)=(history_deleted_by is null));
create index calibration_request_history_deleted_by on public.calibration_requests(history_deleted_by) where history_deleted_by is not null;
create policy calibration_requests_visible_history on public.calibration_requests as restrictive for select to authenticated using(history_deleted_at is null);
create or replace function private.guard_calibration_request() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.equipment; holder public.employee_directory; supervisor text;
begin
 if auth.uid() is null then raise exception 'Akun aktif diperlukan.' using errcode='42501';end if;
 if tg_op='UPDATE' then
  if old.history_deleted_at is not null then raise exception 'Histori sudah dihapus dari daftar.';end if;
  if new.history_deleted_at is distinct from old.history_deleted_at or new.history_deleted_by is distinct from old.history_deleted_by then
   if not private.target_has_role(auth.uid(),old.branch_code,'super_admin') or old.status not in ('completed','cancelled') or new.history_deleted_at is null then raise exception 'Hapus histori hanya untuk IT Officer pada pengajuan yang ditutup.' using errcode='42501';end if;
   if (to_jsonb(new)-array['history_deleted_at','history_deleted_by','version','updated_at','updated_by']) is distinct from (to_jsonb(old)-array['history_deleted_at','history_deleted_by','version','updated_at','updated_by']) then raise exception 'Hapus histori tidak dapat mengubah isian pengajuan.';end if;
   new.history_deleted_at:=now();new.history_deleted_by:=auth.uid();new.version:=old.version+1;new.updated_by:=auth.uid();new.updated_at:=now();return new;
  end if;
 end if;
 if tg_op='INSERT' then
  if new.history_deleted_at is not null or new.history_deleted_by is not null then raise exception 'Metadata histori tidak dapat diisi saat pengajuan.';end if;
  if new.status<>'submitted' or not private.calibration_request_scope(new.branch_code,new.equipment_id,'requester') then raise exception 'Pengajuan hanya oleh Koordinator Operasional sesuai portofolio.' using errcode='42501';end if;
  if new.estimated_days is not null or new.estimated_cost is not null or new.requester_signed or new.supervisor_signed or new.signed_document_id is not null or new.calibration_id is not null then raise exception 'Biaya, hari kerja dan administrasi lanjutan diisi manual di Excel.';end if;
  if length(trim(coalesce(new.request_number,'')))<2 or length(trim(coalesce(new.unit_name,'')))<2 or length(trim(new.notes))<8 then raise exception 'Lengkapi nomor permintaan, unit kerja dan keterangan minimal 8 karakter.';end if;
  select * into e from public.equipment where id=new.equipment_id and branch_code=new.branch_code and ownership='internal';
  if e.id is null then raise exception 'Alat internal tidak ditemukan.';end if;
  new.equipment_snapshot:=jsonb_build_object('name',e.name,'tag',e.tag,'asset_id',e.asset_id,'serial',e.serial,'brand',e.brand,'model',e.model,'location',e.location,'measurement_range',e.measurement_range,'specification_size',e.specification_size,'portfolio_id',e.portfolio_id);
  select d.* into holder from public.profiles p join public.employee_directory d on d.id=p.employee_id and d.branch_code=new.branch_code where p.id=auth.uid() and d.archived_at is null and d.merged_into_employee_id is null;
  new.requester_employee_id:=holder.id;new.requester_npp:=holder.npp;
  new.requester_name:=coalesce(holder.full_name,(select full_name from public.profiles where id=auth.uid()));
  new.supervisor_name:=null;
  if new.supervisor_profile_id is not null then
   select coalesce(d.full_name,p.full_name) into supervisor from public.profiles p left join public.employee_directory d on d.id=p.employee_id and d.branch_code=new.branch_code where p.id=new.supervisor_profile_id and (private.target_has_role(p.id,new.branch_code,'department_head') or private.target_has_role(p.id,new.branch_code,'unit_head'));
   if supervisor is null then raise exception 'Pejabat tidak aktif pada cabang ini.';end if;
   new.supervisor_name:=supervisor;
  end if;
  new.created_by:=auth.uid();new.created_at:=now();new.version:=1;
 else
  if new.status='cancelled' then
   if not (private.has_role(old.branch_code,array['admin']) or private.calibration_request_scope(old.branch_code,old.equipment_id,'ptk') or (old.created_by=auth.uid() and private.calibration_request_scope(old.branch_code,old.equipment_id,'requester'))) then raise exception 'Tidak berwenang membatalkan pengajuan.' using errcode='42501';end if;
  elsif not private.calibration_request_scope(old.branch_code,old.equipment_id,'ptk') then raise exception 'Progres hanya dapat diperbarui PTK.' using errcode='42501';end if;
  if old.status in ('completed','cancelled') then raise exception 'Pengajuan sudah ditutup.';end if;
  if new.status not in ('accepted','completed','cancelled') or new.status=old.status then raise exception 'Pilih Mulai Proses atau Selesai.';end if;
  if (to_jsonb(new)-array['status','version','updated_at','updated_by']) is distinct from (to_jsonb(old)-array['status','version','updated_at','updated_by']) then raise exception 'Isian pengajuan tetap; administrasi lanjutan dilakukan manual di Excel.' using errcode='42501';end if;
  new.version:=old.version+1;
 end if;
 new.updated_by:=auth.uid();new.updated_at:=now();return new;
end $$;

create function public.manage_equipment_request(r uuid,expected_version integer,operation text) returns void
language plpgsql security definer set search_path='' as $$
declare v public.calibration_requests;
begin
 if auth.uid() is null then raise exception 'Akun aktif diperlukan.' using errcode='42501';end if;
 select * into v from public.calibration_requests where id=r and history_deleted_at is null for update;
 if v.id is null or not private.calibration_request_scope(v.branch_code,v.equipment_id,'read') then raise exception 'Pengajuan tidak ditemukan atau tidak dapat diakses.' using errcode='42501';end if;
 if expected_version is null or v.version<>expected_version then raise exception 'Pengajuan sudah berubah. Muat ulang terlebih dahulu.' using errcode='40001';end if;
 if operation='cancel' then
  -- Trigger validates creator/coordinator, PTK or branch administrator and immutable contents.
  update public.calibration_requests set status='cancelled' where id=r;
 elsif operation='delete_history' then
  -- Trigger validates exact Super Admin role and closed state; audit trigger records the decision.
  update public.calibration_requests set history_deleted_at=now(),history_deleted_by=auth.uid() where id=r;
 else raise exception 'Tindakan tidak dikenal.';end if;
end $$;
revoke all on function public.manage_equipment_request(uuid,integer,text) from public,anon;
grant execute on function public.manage_equipment_request(uuid,integer,text) to authenticated;
