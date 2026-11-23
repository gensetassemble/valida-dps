-- Client certificate imports use the existing private staging/review tables.
-- Reviewers must classify each approved row as a new certificate or a data
-- correction. Corrections use an explicit old certificate number and never
-- guess which production record should be changed.

create or replace function private.validate_import_approval()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
  d text;
  n jsonb := new.normalized_values;
  k text;
  v text;
  old_certificate text;
begin
  if new.decision <> 'approved' then return new; end if;
  select domain into d from public.import_batches
   where id=new.batch_id and branch_code=new.branch_code;
  if coalesce(nullif(new.raw_values->>'BranchCode',''),nullif(new.raw_values->>'Cabang Operasional',''),new.branch_code) <> new.branch_code then
    raise exception 'Cabang sumber tidak cocok dengan target staging.';
  end if;
  if not private.has_role(new.branch_code,array['admin']) then
    raise exception 'Admin diperlukan.' using errcode='42501';
  end if;
  foreach k in array array['issue_date','expiry_date','calibration_date','due_date'] loop
    v:=nullif(n->>k,'');
    if v is not null and (v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char(v::date,'YYYY-MM-DD')<>v) then
      raise exception 'Tanggal ISO tidak valid.';
    end if;
  end loop;
  if nullif(n->>'interval_months','') is not null and (n->>'interval_months')::integer not between 1 and 600 then
    raise exception 'Interval tidak valid.';
  end if;
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
    if coalesce(n->>'change_reason','') not in ('new_certificate','data_correction') then raise exception 'Pilih alasan perubahan sertifikat.';end if;
    if nullif(n->>'certificate_number','') is null or nullif(n->>'object_type','') is null or nullif(n->>'issue_date','') is null or nullif(n->>'expiry_date','') is null then raise exception 'Identitas objek dan tanggal wajib ditinjau.';end if;
    old_certificate:=coalesce(nullif(n->>'existing_certificate_number',''),nullif(n->>'certificate_number',''));
    if n->>'change_reason'='data_correction' then
      if (select count(*) from public.client_certificates c where c.branch_code=new.branch_code and c.client_id=(n->>'client_id')::uuid and c.certificate_type_id=(n->>'certificate_type_id')::uuid and private.uma_identity_key(c.certificate_number)=private.uma_identity_key(old_certificate)) <> 1 then
        raise exception 'Sertifikat lama untuk koreksi tidak ditemukan secara unik.';
      end if;
    elsif exists(select 1 from public.client_certificates c where c.branch_code=new.branch_code and c.client_id=(n->>'client_id')::uuid and c.certificate_type_id=(n->>'certificate_type_id')::uuid and private.uma_identity_key(c.certificate_number)=private.uma_identity_key(n->>'certificate_number')) then
      raise exception 'Nomor sertifikat sudah ada. Pilih koreksi data bila ingin memperbaruinya.';
    end if;
  end if;
  return new;
end
$$;

create or replace function private.commit_client_certificate_import(batch uuid)
returns integer
language plpgsql
security invoker
set search_path=''
as $$
declare
  info public.import_batches;
  r public.import_rows;
  n jsonb;
  target uuid;
  previous uuid;
  old_certificate text;
  cnt integer := 0;
begin
  select * into info from public.import_batches where id=batch for update;
  if not found or info.domain<>'clients' or not private.has_role(info.branch_code,array['admin']) then
    raise exception 'Akses impor sertifikat klien ditolak.' using errcode='42501';
  end if;
  for r in select * from public.import_rows where batch_id=batch and decision='approved' order by source_row,id for update loop
    if r.reviewed_by is null then raise exception 'Persetujuan manusia diperlukan.';end if;
    n:=r.normalized_values;
    if coalesce(n->>'change_reason','') not in ('new_certificate','data_correction') then raise exception 'Alasan perubahan sertifikat belum dipilih.';end if;
    target:=null;previous:=null;
    old_certificate:=coalesce(nullif(n->>'existing_certificate_number',''),nullif(n->>'certificate_number',''));
    if n->>'change_reason'='data_correction' then
      select c.id into strict target from public.client_certificates c
       where c.branch_code=info.branch_code
        and c.client_id=(n->>'client_id')::uuid
        and c.certificate_type_id=(n->>'certificate_type_id')::uuid
        and private.uma_identity_key(c.certificate_number)=private.uma_identity_key(old_certificate)
       for update;
      update public.client_certificates set
       certificate_number=n->>'certificate_number',object_type=n->>'object_type',object_serial=nullif(n->>'object_serial',''),
       installation_location=nullif(n->>'installation_location',''),order_reference=nullif(n->>'order_reference',''),contract_reference=nullif(n->>'contract_reference',''),
       issue_date=nullif(n->>'issue_date','')::date,expiry_date=nullif(n->>'expiry_date','')::date,
       interval_months=nullif(n->>'interval_months','')::integer,interval_days=nullif(n->>'interval_days','')::integer,
       certificate_work_area_id=nullif(n->>'certificate_work_area_id','')::uuid,portfolio_id=nullif(n->>'portfolio_id','')::uuid,
       previous_order_value=nullif(n->>'previous_order_value','')::numeric,verification_status='pending'
       where id=target;
    else
      select c.id into previous from public.client_certificates c
       where c.branch_code=info.branch_code and c.client_id=(n->>'client_id')::uuid
        and c.certificate_type_id=(n->>'certificate_type_id')::uuid and c.is_active
        and not exists(select 1 from public.client_certificates newer where newer.previous_certificate_id=c.id and newer.branch_code=c.branch_code and newer.is_active)
        and nullif(n->>'object_serial','') is not null
        and private.uma_identity_key(c.object_serial)=private.uma_identity_key(n->>'object_serial')
       order by c.expiry_date desc nulls last,c.created_at desc limit 1;
      insert into public.client_certificates(
       client_id,certificate_type_id,certificate_number,object_type,object_serial,installation_location,order_reference,contract_reference,
       issue_date,expiry_date,interval_months,interval_days,certificate_work_area_id,portfolio_id,previous_order_value,
       previous_certificate_id,branch_code,verification_status,source_import_row_id)
      values(
       (n->>'client_id')::uuid,(n->>'certificate_type_id')::uuid,n->>'certificate_number',n->>'object_type',nullif(n->>'object_serial',''),nullif(n->>'installation_location',''),nullif(n->>'order_reference',''),nullif(n->>'contract_reference',''),
       nullif(n->>'issue_date','')::date,nullif(n->>'expiry_date','')::date,nullif(n->>'interval_months','')::integer,nullif(n->>'interval_days','')::integer,nullif(n->>'certificate_work_area_id','')::uuid,nullif(n->>'portfolio_id','')::uuid,nullif(n->>'previous_order_value','')::numeric,
       previous,info.branch_code,'pending',r.id)
      returning id into target;
    end if;
    update public.import_rows set decision='committed',committed_record_id=target where id=r.id;
    cnt:=cnt+1;
  end loop;
  insert into public.audit_logs(table_name,record_id,action,actor_id,new_values,branch_code,database_actor)
   values('import_batches',batch::text,'UPDATE',auth.uid(),jsonb_build_object('committed_count',cnt,'domain','clients','screened',true),info.branch_code,session_user);
  return cnt;
end
$$;

create or replace function public.commit_client_certificate_import(batch uuid)
returns integer
language sql
security invoker
set search_path=''
as $$select private.commit_client_certificate_import(batch);$$;

revoke all on function private.commit_client_certificate_import(uuid),public.commit_client_certificate_import(uuid) from public,anon;
grant execute on function private.commit_client_certificate_import(uuid),public.commit_client_certificate_import(uuid) to authenticated;
