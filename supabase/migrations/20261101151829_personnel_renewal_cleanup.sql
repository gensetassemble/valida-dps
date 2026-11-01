alter table public.personnel_renewal_cases
 add column history_deleted_at timestamptz,
 add column history_deleted_by uuid references public.profiles(id),
 add column cleanup_reason text;
create index personnel_renewal_deleted_actor on public.personnel_renewal_cases(history_deleted_by);
alter table public.personnel_renewal_cases drop constraint personnel_renewal_cases_status_check;
alter table public.personnel_renewal_cases add constraint personnel_renewal_cases_status_check check(status in ('unprocessed','processing','renewed','cancelled'));
alter table public.personnel_renewal_cases drop constraint personnel_renewal_cases_certificate_id_key;
create unique index personnel_renewal_current_certificate on public.personnel_renewal_cases(certificate_id) where status<>'cancelled';
create or replace function private.guard_personnel_renewal() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.personnel_certificates;r public.personnel_certificates;
begin
 if auth.uid() is null or not private.has_role(new.branch_code,array['admin','hrga']) then raise exception 'Pembaruan proses hanya oleh HRGA/administrator.' using errcode='42501';end if;
 if tg_op='UPDATE' then
  if old.history_deleted_at is not null then raise exception 'Histori sudah dihapus dari daftar.';end if;
  if new.history_deleted_at is distinct from old.history_deleted_at then
   if old.status not in ('renewed','cancelled') or new.history_deleted_at is null then raise exception 'Tutup atau batalkan proses sebelum menghapus histori.';end if;
   if (to_jsonb(new)-array['history_deleted_at','history_deleted_by','cleanup_reason','updated_at','updated_by','version']) is distinct from (to_jsonb(old)-array['history_deleted_at','history_deleted_by','cleanup_reason','updated_at','updated_by','version']) then raise exception 'Penghapusan histori tidak mengubah hasil proses.';end if;
   if length(trim(coalesce(new.cleanup_reason,''))) not between 8 and 2000 then raise exception 'Alasan penghapusan minimal 8 karakter.';end if;
   new.history_deleted_at:=now();new.history_deleted_by:=auth.uid();new.updated_at:=now();new.updated_by:=auth.uid();new.version:=old.version+1;return new;
  end if;
 end if;
 if new.history_deleted_at is not null or new.history_deleted_by is not null or new.cleanup_reason is not null then raise exception 'Metadata histori tidak boleh diubah langsung.';end if;
 select * into c from public.personnel_certificates where id=new.certificate_id and branch_code=new.branch_code;
 if c.id is null or c.validity_kind='lifetime' then raise exception 'Sertifikat tidak ditemukan atau berlaku seumur hidup.';end if;
 if length(trim(new.notes))<8 then raise exception 'Catatan proses minimal 8 karakter.';end if;
 if tg_op='INSERT' then
  if new.status<>'unprocessed' then raise exception 'Proses dimulai dari Belum Diproses.';end if;
  new.created_at:=now();new.created_by:=auth.uid();new.version:=1;
 else
  if new.id<>old.id or new.certificate_id<>old.certificate_id or new.branch_code<>old.branch_code or new.created_by is distinct from old.created_by then raise exception 'Identitas proses tetap.';end if;
  new.created_at:=old.created_at;new.version:=old.version+1;
  if old.status in ('renewed','cancelled') then raise exception 'Proses sudah selesai; riwayat dipertahankan.';end if;
  if not (new.status=old.status or (old.status='unprocessed' and new.status='processing') or (old.status='processing' and new.status='renewed') or (old.status in ('unprocessed','processing') and new.status='cancelled')) then raise exception 'Urutan gate HRGA tidak valid.';end if;
 end if;
 if new.status='renewed' then
  select * into r from public.personnel_certificates where id=new.replacement_certificate_id;
  if r.id is null or r.id=c.id or r.employee_id<>c.employee_id or r.branch_code<>c.branch_code or r.certificate_type_id<>c.certificate_type_id or not r.is_active or r.issue_date is null or r.certificate_number is null or (r.validity_kind='term' and (r.expiry_date is null or r.expiry_date<=coalesce(c.expiry_date,'0001-01-01'::date))) then raise exception 'Sertifikat pengganti harus milik pegawai dan jenis yang sama, lengkap, dengan masa berlaku baru.';end if;
  if not exists(select 1 from public.operational_documents d join storage.objects s on s.name=d.object_path and s.bucket_id='certificate-documents' where d.domain='personnel' and d.record_id=r.id and d.kind='certificate' and d.branch_code=r.branch_code) and r.source_folder_url is null then raise exception 'Bukti PDF atau referensi folder dokumen pengganti diperlukan.';end if;
 elsif new.replacement_certificate_id is not null then raise exception 'Tautan pengganti hanya diisi saat penyelesaian.';end if;
 new.updated_at:=now();new.updated_by:=auth.uid();return new;
end $$;


create or replace function private.guard_active_personnel_renewal() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (tg_op='INSERT' or new.status is distinct from old.status) and new.status<>'cancelled' then
  if exists(select 1 from public.personnel_certificates c join public.employee_directory e on e.id=c.employee_id and e.branch_code=c.branch_code where c.id=new.certificate_id and c.branch_code=new.branch_code and e.employment_status='inactive') then raise exception 'Personil nonaktif tidak dapat melanjutkan perpanjangan. Riwayat tetap tersedia.';end if;
 end if;
 return new;
end $$;
create function public.manage_personnel_renewal(r uuid,b text,expected_version integer,operation text,reason text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare w public.personnel_renewal_cases;
begin
 if auth.uid() is null or not private.has_role(b,array['admin','hrga']) then raise exception 'Tindakan hanya untuk HRGA/administrator pada cabang ini.' using errcode='42501';end if;
 if expected_version is null or expected_version<1 or length(trim(coalesce(reason,''))) not between 8 and 2000 then raise exception 'Versi dan alasan minimal 8 karakter diperlukan.';end if;
 select * into w from public.personnel_renewal_cases where id=r and branch_code=b for update;
 if w.id is null or w.version<>expected_version or w.history_deleted_at is not null then raise exception 'Data berubah atau tidak tersedia. Muat ulang.';end if;
 if operation='cancel' and w.status in ('unprocessed','processing') then
  update public.personnel_renewal_cases set status='cancelled',notes=trim(reason) where id=w.id;
 elsif operation='delete_history' and w.status in ('renewed','cancelled') then
  update public.personnel_renewal_cases set history_deleted_at=now(),cleanup_reason=trim(reason) where id=w.id;
 else raise exception 'Batalkan proses aktif dahulu. Hasil perpanjangan selesai tidak dapat dibatalkan.';end if;
 return w.certificate_id;
end $$;
revoke all on function public.manage_personnel_renewal(uuid,text,integer,text,text) from public,anon;
grant execute on function public.manage_personnel_renewal(uuid,text,integer,text,text) to authenticated;
create or replace view public.personnel_certificate_portfolios with(security_invoker=true) as
select c.*,array(select distinct a.portfolio_id from public.employee_portfolio_assignments a
 where a.employee_id=c.employee_id and a.branch_code=c.branch_code and a.is_active and a.verification_status='verified'
 and a.effective_from<=(now() at time zone 'Asia/Makassar')::date and (a.effective_until is null or a.effective_until>=(now() at time zone 'Asia/Makassar')::date)) as portfolio_ids,
 coalesce(own.status,prior.status,'unprocessed') as renewal_status,
 case when own.status='renewed' then own.replacement_certificate_id end as superseded_by_certificate_id,
 prior.certificate_id as previous_certificate_id
from public.personnel_certificate_records c
left join public.personnel_renewal_cases own on own.certificate_id=c.id and own.branch_code=c.branch_code and own.status<>'cancelled'
left join public.personnel_renewal_cases prior on prior.replacement_certificate_id=c.id and prior.branch_code=c.branch_code and prior.status='renewed';

CREATE OR REPLACE FUNCTION private.record_operational_workflow_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare event uuid:=gen_random_uuid();holder uuid;available boolean;link text;title text;portfolio uuid;
begin
 if tg_op='UPDATE' and new.status=old.status then return new;end if;
 if tg_table_name='calibration_requests' then
  insert into public.calibration_request_events(id,request_id,branch_code,previous_status,new_status,notes,actor_id) values(event,new.id,new.branch_code,case when tg_op='UPDATE' then old.status end,new.status,new.notes,auth.uid());
  link:='/kalibrasi-alat/'||new.equipment_id::text||'?branch='||new.branch_code;
  title:='Permintaan kalibrasi: '||case new.status when 'submitted' then 'Diajukan ke PTK' when 'correction' then 'Perlu Perbaikan Dokumen' when 'accepted' then 'Diterima PTK' when 'completed' then 'Selesai' when 'cancelled' then 'Dibatalkan' when 'awaiting_signatures' then 'Menunggu Tanda Tangan' else 'Draf' end;
  select portfolio_id into portfolio from public.equipment where id=new.equipment_id;
  insert into public.user_notifications(branch_code,profile_id,event_id,title,href)
  select distinct new.branch_code,p.id,event,title,link from public.profiles p where p.is_active and (p.id=new.created_by or (new.status='submitted' and exists(select 1 from public.user_role_assignments g where g.profile_id=p.id and g.branch_code=new.branch_code and g.is_active and g.revoked_at is null and (g.role_code in ('admin','super_admin') or (g.role_code='equipment_manager' and exists(select 1 from public.employee_portfolio_assignments a where a.employee_id=p.employee_id and a.portfolio_id=portfolio and a.assignment_type='equipment_responsible' and a.is_active and a.verification_status='verified' and a.approved_at is not null and a.effective_from<=current_date and (a.effective_until is null or a.effective_until>=current_date))))))) on conflict do nothing;
 else
  select employee_id into holder from public.personnel_certificates where id=new.certificate_id;
  select exists(select 1 from public.profiles p where p.employee_id=holder and p.is_active and p.branch_code=new.branch_code and exists(select 1 from public.user_role_assignments g join public.roles ro on ro.code=g.role_code and ro.is_active where g.profile_id=p.id and g.branch_code=new.branch_code and g.is_active and g.revoked_at is null and (g.role_code in ('inspector','hrga','admin','super_admin','branch_head','department_head','unit_head','tester') or (g.role_code in ('coordinator','qshe') and exists(select 1 from public.employee_portfolio_assignments a where a.employee_id=p.employee_id and a.branch_code=new.branch_code and a.assignment_type=g.role_code and a.is_active and a.verification_status='verified' and a.approved_at is not null and a.effective_from<=(now() at time zone 'Asia/Makassar')::date and (a.effective_until is null or a.effective_until>=(now() at time zone 'Asia/Makassar')::date)))))) into available;
  insert into public.personnel_renewal_events(id,case_id,branch_code,previous_status,new_status,notes,actor_id,holder_delivery_available) values(event,new.id,new.branch_code,case when tg_op='UPDATE' then old.status end,new.status,new.notes,auth.uid(),available);
  link:='/kompetensi-personil/'||new.certificate_id::text||'?branch='||new.branch_code;
  title:='Status perpanjangan sertifikat: '||case new.status when 'processing' then 'Sedang Diproses' when 'renewed' then 'Sudah Diperpanjang' when 'cancelled' then 'Dibatalkan' else 'Belum Diproses' end;
  insert into public.user_notifications(branch_code,profile_id,event_id,title,href)
  select distinct new.branch_code,p.id,event,title,link from public.profiles p where p.is_active and p.branch_code=new.branch_code and exists(select 1 from public.user_role_assignments g join public.roles ro on ro.code=g.role_code and ro.is_active where g.profile_id=p.id and g.branch_code=new.branch_code and g.is_active and g.revoked_at is null and (g.role_code in ('hrga','admin','super_admin') or (p.employee_id=holder and g.role_code in ('inspector','branch_head','department_head','unit_head','tester')) or (g.role_code in ('coordinator','qshe') and exists(select 1 from public.employee_portfolio_assignments recipient join public.employee_portfolio_assignments subject on subject.portfolio_id=recipient.portfolio_id and subject.branch_code=recipient.branch_code where recipient.employee_id=p.employee_id and recipient.branch_code=new.branch_code and recipient.assignment_type=g.role_code and recipient.is_active and recipient.verification_status='verified' and recipient.approved_at is not null and recipient.effective_from<=(now() at time zone 'Asia/Makassar')::date and (recipient.effective_until is null or recipient.effective_until>=(now() at time zone 'Asia/Makassar')::date) and subject.employee_id=holder and subject.is_active and subject.verification_status='verified' and subject.effective_from<=(now() at time zone 'Asia/Makassar')::date and (subject.effective_until is null or subject.effective_until>=(now() at time zone 'Asia/Makassar')::date))))) on conflict do nothing;
 end if;
 return new;
end $function$;
create or replace view public.user_notification_details with(security_invoker=true) as
select n.*,
 case when ev.id is not null and c.id is not null then
  coalesce(e.full_name,'Pegawai')||' · '||coalesce(nullif(c.original_title,''),t.name,'Lisensi')||' · No. '||coalesce(c.certificate_number,'Belum diisi')||' · '||
  case ev.new_status when 'renewed' then 'Sudah Diperpanjang' when 'processing' then 'Sedang Diproses' when 'cancelled' then 'Dibatalkan' else 'Belum Diproses' end
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
