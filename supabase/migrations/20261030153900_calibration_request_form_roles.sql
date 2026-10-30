-- UMA identities are snapshots. No existing request or directory identity is rewritten.
alter table public.calibration_requests
 add column requester_employee_id uuid,
 add column requester_npp text,
 add column supervisor_profile_id uuid references public.profiles(id),
 add foreign key(requester_employee_id,branch_code) references public.employee_directory(id,branch_code);
create index calibration_requests_requester_employee on public.calibration_requests(requester_employee_id);
create index calibration_requests_supervisor_profile on public.calibration_requests(supervisor_profile_id);

-- Minimal lookup only; do not expose profile emails, NPPs or role assignment rows.
create function private.calibration_supervisors(b text)
returns table(id uuid,full_name text,role_code text)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.has_role(b,array['admin','coordinator','equipment_manager']) then raise exception 'Akses pilihan pejabat ditolak.' using errcode='42501';end if;
 return query select p.id,coalesce(d.full_name,p.full_name),a.role_code from public.profiles p
 join public.user_role_assignments a on a.profile_id=p.id and a.branch_code=b and a.role_code in ('department_head','unit_head')
 left join public.employee_directory d on d.id=p.employee_id and d.branch_code=b
 where private.target_has_role(p.id,b,a.role_code) and a.is_active and a.revoked_at is null
 and (d.id is null or (d.archived_at is null and d.merged_into_employee_id is null))
 order by coalesce(d.full_name,p.full_name),a.role_code;
end $$;
revoke all on function private.calibration_supervisors(text) from public,anon,authenticated;
grant execute on function private.calibration_supervisors(text) to authenticated;
create function public.calibration_request_supervisors(b text)
returns table(id uuid,full_name text,role_code text)
language sql stable security invoker set search_path='' as $$select * from private.calibration_supervisors(b);$$;
revoke all on function public.calibration_request_supervisors(text) from public,anon,authenticated;
grant execute on function public.calibration_request_supervisors(text) to authenticated;

create or replace function private.guard_calibration_request() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.equipment; holder public.employee_directory; supervisor text;
begin
 if auth.uid() is null then raise exception 'Akun aktif diperlukan.' using errcode='42501';end if;
 if tg_op='INSERT' then
  if new.status<>'draft' or not private.calibration_request_scope(new.branch_code,new.equipment_id,'requester') then raise exception 'Permintaan harus dimulai sebagai draf oleh koordinator berwenang.' using errcode='42501';end if;
  select * into e from public.equipment where id=new.equipment_id and branch_code=new.branch_code and ownership='internal';
  if e.id is null then raise exception 'Alat internal tidak ditemukan.';end if;
  new.equipment_snapshot:=jsonb_build_object('name',e.name,'tag',e.tag,'asset_id',e.asset_id,'serial',e.serial,'brand',e.brand,'model',e.model,'location',e.location,'measurement_range',e.measurement_range,'specification_size',e.specification_size,'portfolio_id',e.portfolio_id,'responsible_assignment_id',e.responsible_coordinator_assignment_id);
  if new.estimated_days is not null or new.estimated_cost is not null then raise exception 'Waktu dan biaya diisi PTK/Fungsi Umum setelah pengajuan diterima.' using errcode='42501';end if;
  select d.* into holder from public.profiles p join public.employee_directory d on d.id=p.employee_id and d.branch_code=new.branch_code where p.id=auth.uid() and d.merged_into_employee_id is null and d.archived_at is null;
  new.requester_employee_id:=holder.id;new.requester_npp:=holder.npp;
  new.requester_name:=coalesce(holder.full_name,(select p.full_name from public.profiles p where p.id=auth.uid()));
  new.created_by:=auth.uid();new.created_at:=now();new.version:=1;
  new.signed_document_id:=null;new.calibration_id:=null;new.requester_signed:=false;new.supervisor_signed:=false;
 else
  if new.id<>old.id or new.branch_code<>old.branch_code or new.equipment_id<>old.equipment_id or new.created_by is distinct from old.created_by or new.equipment_snapshot<>old.equipment_snapshot then raise exception 'Identitas dan snapshot permintaan tetap.' using errcode='42501';end if;
  new.created_at:=old.created_at;new.version:=old.version+1;
  if row(new.requester_name,new.requester_employee_id,new.requester_npp) is distinct from row(old.requester_name,old.requester_employee_id,old.requester_npp) then raise exception 'Nama dan NPP pengaju mengikuti identitas saat draf dibuat.' using errcode='42501';end if;
  -- Older drafts acquire the original creator's NPP only when explicitly saved.
  if old.requester_employee_id is null and old.status in ('draft','awaiting_signatures','correction') then
   select d.* into holder from public.profiles p join public.employee_directory d on d.id=p.employee_id and d.branch_code=new.branch_code where p.id=old.created_by and d.merged_into_employee_id is null and d.archived_at is null;
   new.requester_employee_id:=holder.id;new.requester_npp:=holder.npp;
  end if;
  if row(new.estimated_days,new.estimated_cost) is distinct from row(old.estimated_days,old.estimated_cost) and (not private.calibration_request_scope(new.branch_code,new.equipment_id,'ptk') or old.created_by=auth.uid() or old.status not in ('submitted','accepted')) then raise exception 'Waktu dan biaya hanya diisi PTK/Fungsi Umum, bukan pengaju.' using errcode='42501';end if;
  if old.status in ('completed','cancelled') then raise exception 'Permintaan sudah ditutup.';end if;
  if new.status=old.status then
   if not ((old.status in ('draft','awaiting_signatures','correction') and private.calibration_request_scope(new.branch_code,new.equipment_id,'requester')) or (old.status in ('submitted','accepted') and private.calibration_request_scope(new.branch_code,new.equipment_id,'ptk'))) then raise exception 'Draf tidak dapat diubah oleh akun ini.' using errcode='42501';end if;
  elsif (old.status in ('draft','correction') and new.status='awaiting_signatures') or (old.status in ('awaiting_signatures','correction') and new.status='submitted') or (new.status='cancelled' and old.status in ('draft','awaiting_signatures','correction')) then
   if not private.calibration_request_scope(new.branch_code,new.equipment_id,'requester') then raise exception 'Transisi pengaju ditolak.' using errcode='42501';end if;
  elsif (old.status='submitted' and new.status in ('accepted','correction')) or (old.status='accepted' and new.status in ('completed','correction','cancelled')) then
   if not private.calibration_request_scope(new.branch_code,new.equipment_id,'ptk') then raise exception 'Transisi PTK ditolak.' using errcode='42501';end if;
  else raise exception 'Urutan status permintaan tidak valid.';end if;
  if old.status in ('submitted','accepted') and (to_jsonb(new)-array['status','notes','calibration_id','estimated_days','estimated_cost','version','updated_at','updated_by','created_at']) is distinct from (to_jsonb(old)-array['status','notes','calibration_id','estimated_days','estimated_cost','version','updated_at','updated_by','created_at']) then raise exception 'PTK tidak boleh mengubah isi atau tanda tangan formulir pengaju.';end if;
 end if;
 if tg_op='INSERT' or new.supervisor_profile_id is distinct from old.supervisor_profile_id then
  if new.supervisor_profile_id is not null then
   select coalesce(d.full_name,p.full_name) into supervisor from public.profiles p left join public.employee_directory d on d.id=p.employee_id and d.branch_code=new.branch_code where p.id=new.supervisor_profile_id and (private.target_has_role(p.id,new.branch_code,'department_head') or private.target_has_role(p.id,new.branch_code,'unit_head')) and (d.id is null or (d.archived_at is null and d.merged_into_employee_id is null));
   if supervisor is null then raise exception 'Pilih Kepala Bidang atau Kepala UP aktif pada cabang yang sama.';end if;
   new.supervisor_name:=supervisor;
  else new.supervisor_name:=null;end if;
 elsif new.supervisor_name is distinct from old.supervisor_name then raise exception 'Nama pejabat mengikuti pilihan Kepala Bidang/Kepala UP.' using errcode='42501';
 end if;
 if (tg_op='INSERT' or new.status is distinct from old.status) and new.status in ('awaiting_signatures','submitted') and (new.supervisor_profile_id is null or not (private.target_has_role(new.supervisor_profile_id,new.branch_code,'department_head') or private.target_has_role(new.supervisor_profile_id,new.branch_code,'unit_head'))) then raise exception 'Pilih Kepala Bidang atau Kepala UP aktif sebelum menyiapkan tanda tangan/pengajuan.';end if;
 if length(trim(new.notes))<8 then raise exception 'Catatan minimal 8 karakter.';end if;
 if new.status='submitted' then
  if length(trim(coalesce(new.request_number,'')))<2 or length(trim(coalesce(new.requester_name,'')))<2 or length(trim(coalesce(new.supervisor_name,'')))<2 or not new.requester_signed or not new.supervisor_signed or not exists(select 1 from public.workflow_documents d join storage.objects o on o.name=d.object_path and o.bucket_id='workflow-documents' where d.id=new.signed_document_id and d.request_id=new.id and d.branch_code=new.branch_code) then raise exception 'Nomor permintaan, nama pengaju/Kabid, konfirmasi dua tanda tangan dan PDF bertanda tangan wajib dilengkapi.';end if;
 end if;
 if new.calibration_id is not null and not exists(select 1 from public.calibrations c where c.id=new.calibration_id and c.branch_code=new.branch_code and c.equipment_id=new.equipment_id and c.created_at>=new.created_at and c.is_active) then raise exception 'Hasil harus berupa peristiwa kalibrasi baru untuk alat yang sama.';end if;
 if new.status='completed' and (new.calibration_id is null or not exists(select 1 from public.calibrations c where c.id=new.calibration_id and c.result is not null and c.certificate_number is not null and c.due_date is not null)) then raise exception 'Tautkan hasil kalibrasi baru yang memuat nomor sertifikat, tanggal akhir dan hasil sebelum selesai.';end if;
 new.updated_by:=auth.uid();new.updated_at:=now();return new;
end $$;

revoke all on function private.guard_calibration_request() from public,anon,authenticated;
