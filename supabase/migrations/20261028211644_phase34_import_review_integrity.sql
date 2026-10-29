create or replace function private.review_import(r uuid,n jsonb,approve boolean,reason text) returns void language plpgsql security definer set search_path='' as $$
declare rowdata public.import_rows;
begin
 select * into rowdata from public.import_rows where id=r for update;
 if not found or not private.has_role(rowdata.branch_code,array['admin']) then raise exception 'Akses review ditolak.' using errcode='42501';end if;
 if rowdata.decision='committed' then raise exception 'Baris telah diimpor.';end if;
 if length(trim(reason))<8 or jsonb_typeof(n)<>'object' or octet_length(n::text)>20000 then raise exception 'Alasan atau koreksi tidak valid.';end if;
 update public.import_rows set normalized_values=rowdata.normalized_values||n,decision=case when approve then 'approved' else 'rejected' end,review_note=reason,reviewed_by=auth.uid(),reviewed_at=now() where id=r;
 insert into public.audit_logs(table_name,record_id,action,actor_id,old_values,new_values,branch_code,database_actor) values('import_rows',r::text,'UPDATE',auth.uid(),jsonb_build_object('decision',rowdata.decision,'normalized_values',rowdata.normalized_values),jsonb_build_object('decision',case when approve then 'approved' else 'rejected' end,'normalized_values',rowdata.normalized_values||n,'review_note',reason),rowdata.branch_code,session_user);
end $$;
create or replace function private.validate_import_approval() returns trigger language plpgsql security invoker set search_path='' as $$
declare d text;n jsonb:=new.normalized_values;k text;v text;
begin
 if new.decision<>'approved' then return new;end if;
 select domain into d from public.import_batches where id=new.batch_id and branch_code=new.branch_code;
 if coalesce(nullif(new.raw_values->>'BranchCode',''),nullif(new.raw_values->>'Cabang Operasional',''),new.branch_code)<>new.branch_code then raise exception 'Cabang sumber tidak cocok dengan target staging.';end if;
 if not private.has_role(new.branch_code,array['admin']) then raise exception 'Admin diperlukan.' using errcode='42501';end if;
 foreach k in array array['issue_date','expiry_date','calibration_date','due_date'] loop
  v:=nullif(n->>k,'');if v is not null and (v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char(v::date,'YYYY-MM-DD')<>v) then raise exception 'Tanggal ISO tidak valid.';end if;
 end loop;
 if nullif(n->>'interval_months','') is not null and (n->>'interval_months')::integer not between 1 and 600 then raise exception 'Interval tidak valid.';end if;
 if d='employees' then
  if coalesce(n->>'npp','') !~ '^[0-9]{5}$' or length(trim(coalesce(n->>'full_name','')))<2 or coalesce(n->>'employment_category','') not in ('PT','PTT_REGULAR','PTT_PROJECT','LS') then raise exception 'NRK/nama/kategori belum dipetakan.';end if;
 elsif d='personnel' then
  if not exists(select 1 from public.employee_directory e where e.id=(n->>'employee_id')::uuid and e.branch_code=new.branch_code) or not exists(select 1 from public.certificate_types t where t.id=(n->>'certificate_type_id')::uuid and t.branch_code=new.branch_code and t.category='personnel' and t.is_active) then raise exception 'Identitas/katalog belum dipetakan.';end if;
  if nullif(n->>'npp','') is not null and exists(select 1 from public.employee_directory e where e.id=(n->>'employee_id')::uuid and e.npp is distinct from (n->>'npp')) then raise exception 'NPP hasil review tidak cocok dengan identitas pegawai yang dipilih.';end if;
  if length(trim(coalesce(n->>'original_title','')))<2 or coalesce(n->>'validity_kind','') not in ('term','lifetime') then raise exception 'Judul/masa berlaku wajib dipilih.';end if;
  if n->>'validity_kind'='term' and nullif(n->>'expiry_date','') is null then raise exception 'Masa berlaku berjangka memerlukan tanggal akhir.';end if;
  if n->>'validity_kind'='lifetime' and (nullif(n->>'expiry_date','') is not null or nullif(n->>'interval_months','') is not null) then raise exception 'Lifetime tidak memakai tanggal akhir/interval.';end if;
 elsif d='calibrations' then
  if not exists(select 1 from public.equipment e where e.id=(n->>'equipment_id')::uuid and e.branch_code=new.branch_code and e.verification_status='verified') then raise exception 'Aset terverifikasi wajib dipetakan.';end if;
  if not exists(select 1 from public.equipment e where e.id=(n->>'equipment_id')::uuid and ((nullif(n->>'asset_tag','') is not null and lower(n->>'asset_tag') in (lower(e.tag),lower(e.asset_id))) or (nullif(n->>'serial','') is not null and lower(n->>'serial')=lower(e.serial)))) then raise exception 'Tag/aset/serial sumber harus cocok dengan identitas alat terverifikasi.';end if;
  if nullif(n->>'calibration_date','') is null or nullif(n->>'due_date','') is null then raise exception 'Tanggal kalibrasi/akhir wajib ditinjau.';end if;
 elsif d='clients' then
  if not exists(select 1 from public.clients c where c.id=(n->>'client_id')::uuid and c.branch_code=new.branch_code) or not exists(select 1 from public.certificate_types t where t.id=(n->>'certificate_type_id')::uuid and t.branch_code=new.branch_code and t.category='client' and t.is_active) then raise exception 'Pelanggan/katalog belum dipetakan.';end if;
  if exists(select 1 from public.client_certificates c where c.client_id=(n->>'client_id')::uuid and c.certificate_type_id=(n->>'certificate_type_id')::uuid and c.certificate_number=nullif(n->>'certificate_number','')) then raise exception 'Kemungkinan nomor sertifikat duplikat pada pelanggan yang sama.';end if;
  if nullif(n->>'certificate_number','') is null or nullif(n->>'object_type','') is null or nullif(n->>'issue_date','') is null or nullif(n->>'expiry_date','') is null then raise exception 'Identitas objek dan tanggal wajib ditinjau.';end if;
 end if;
 return new;
end $$;

alter policy corrections_insert on public.personnel_correction_requests to authenticated with check(
 created_by=(select auth.uid()) and exists(select 1 from public.personnel_certificates c where c.id=certificate_id and c.branch_code=personnel_correction_requests.branch_code
 and (private.has_role(c.branch_code,array['admin','hrga']) or (private.has_role(c.branch_code,array['inspector']) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.employee_id=c.employee_id)))));
create trigger audit_document_metadata after insert on public.operational_documents for each row execute function private.audit_business_record();
create trigger audit_correction_request after insert on public.personnel_correction_requests for each row execute function private.audit_business_record();
