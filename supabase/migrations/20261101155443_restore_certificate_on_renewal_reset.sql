-- Reset restores the original certificate record with all its original values and evidence.
-- Test replacement records and events remain in the database for audit, excluded from normal monitoring.
drop index public.personnel_renewal_current_certificate;
create unique index personnel_renewal_current_certificate on public.personnel_renewal_cases(certificate_id) where status<>'cancelled' and history_deleted_at is null;
create or replace function private.guard_personnel_renewal() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.personnel_certificates;r public.personnel_certificates;
begin
 if auth.uid() is null or not private.has_role(new.branch_code,array['admin','hrga']) then raise exception 'Pembaruan proses hanya oleh HRGA/administrator.' using errcode='42501';end if;
 if tg_op='UPDATE' then
  if old.history_deleted_at is not null then raise exception 'Histori sudah dihapus dari daftar.';end if;
  if new.history_deleted_at is distinct from old.history_deleted_at then
   if old.status='renewed' and exists(select 1 from public.personnel_renewal_cases later where later.certificate_id=old.replacement_certificate_id and later.branch_code=old.branch_code and later.status<>'cancelled' and later.history_deleted_at is null) then raise exception 'Reset atau tutup siklus perpanjangan terbaru terlebih dahulu.';end if;
   if old.status not in ('renewed','cancelled') or new.history_deleted_at is null then raise exception 'Tutup atau batalkan proses sebelum menghapus histori.';end if;
   if (to_jsonb(new)-array['history_deleted_at','history_deleted_by','cleanup_reason','updated_at','updated_by','version']) is distinct from (to_jsonb(old)-array['history_deleted_at','history_deleted_by','cleanup_reason','updated_at','updated_by','version']) then raise exception 'Penghapusan histori tidak mengubah hasil proses.';end if;
   if length(trim(coalesce(new.cleanup_reason,''))) not between 8 and 2000 then raise exception 'Alasan penghapusan minimal 8 karakter.';end if;
   new.history_deleted_at:=now();new.history_deleted_by:=auth.uid();new.updated_at:=now();new.updated_by:=auth.uid();new.version:=old.version+1;return new;
  end if;
 end if;
 if new.history_deleted_at is not null or new.history_deleted_by is not null or new.cleanup_reason is not null then raise exception 'Metadata histori tidak boleh diubah langsung.';end if;
 if (tg_op='INSERT' or (tg_op='UPDATE' and new.status in ('processing','renewed') and new.status is distinct from old.status)) and exists(select 1 from public.personnel_renewal_cases reset where reset.replacement_certificate_id=new.certificate_id and reset.branch_code=new.branch_code and reset.status='renewed' and reset.history_deleted_at is not null) then raise exception 'Sertifikat hasil testing sudah direset. Gunakan sertifikat sebelumnya.';end if;
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


-- An explicitly stopped/current cycle takes precedence over inherited older progress.
create or replace view public.personnel_certificate_portfolios with(security_invoker=true) as
select c.*,array(select distinct a.portfolio_id from public.employee_portfolio_assignments a
 where a.employee_id=c.employee_id and a.branch_code=c.branch_code and a.is_active and a.verification_status='verified'
 and a.effective_from<=(now() at time zone 'Asia/Makassar')::date and (a.effective_until is null or a.effective_until>=(now() at time zone 'Asia/Makassar')::date)) as portfolio_ids,
 case
 when own.id is not null then case when own.history_deleted_at is null then own.status else 'unprocessed' end
 when exists(select 1 from public.personnel_renewal_cases stopped where stopped.certificate_id=c.id and stopped.branch_code=c.branch_code and (stopped.status='cancelled' or stopped.history_deleted_at is not null)) then 'unprocessed'
 when prior.history_deleted_at is null then coalesce(prior.status,'unprocessed')
 else 'unprocessed' end as renewal_status,
 case when own.status='renewed' then own.replacement_certificate_id end as superseded_by_certificate_id,
 prior.certificate_id as previous_certificate_id
from public.personnel_certificate_records c
left join public.personnel_renewal_cases own on own.certificate_id=c.id and own.branch_code=c.branch_code and own.status<>'cancelled' and own.history_deleted_at is null
left join public.personnel_renewal_cases prior on prior.replacement_certificate_id=c.id and prior.branch_code=c.branch_code and prior.status='renewed'
where prior.id is null or prior.history_deleted_at is null;
