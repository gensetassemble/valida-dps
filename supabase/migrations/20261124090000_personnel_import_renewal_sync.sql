create or replace function private.clean_personnel_renewal_note(value text)
returns text language sql immutable set search_path='' as $$
  select nullif(string_agg(part,' | '),'') from (
    select trim(piece) part
    from unnest(string_to_array(coalesce(value,''),'|')) piece
    where trim(piece)<>''
      and piece !~* '(dalam|sedang).{0,60}(proses|tahap)?[[:space:]]*perpanjang|proses[[:space:]]*perpanjang'
  ) clean;
$$;
revoke all on function private.clean_personnel_renewal_note(text) from public,anon,authenticated;

create or replace function private.stage_personnel_import(b text,f text,h text,sz integer,items jsonb,note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare batch uuid;item jsonb;
begin
 if not private.has_role(b,array['admin']) then raise exception 'Admin cabang diperlukan.' using errcode='42501';end if;
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items) not between 1 and 2500 or octet_length(items::text)>10485760 then raise exception 'Ukuran hasil pembacaan tidak valid.';end if;
 insert into public.import_batches(branch_code,domain,filename,file_hash,file_bytes,source_count,created_by,source_note)
 values(b,'personnel',f,h,sz,jsonb_array_length(items),auth.uid(),note)
 on conflict(branch_code,domain,file_hash) do nothing returning id into batch;
 if batch is null then select id into batch from public.import_batches where branch_code=b and domain='personnel' and file_hash=h;return batch;end if;
 for item in select value from jsonb_array_elements(items) loop
  insert into public.import_rows(batch_id,branch_code,source_sheet,source_row,raw_values,normalized_values,issues,review_status)
  values(batch,b,left(item->>'sheet',120),(item->>'row')::integer,item->'raw',item->'normalized',coalesce(item->'issues','[]'),coalesce(item->>'status','needs_review'));
 end loop;
 insert into public.audit_logs(table_name,record_id,action,actor_id,new_values,branch_code,database_actor)
 values('import_batches',batch::text,'INSERT',auth.uid(),jsonb_build_object('source_count',jsonb_array_length(items),'domain','personnel'),b,session_user);
 return batch;
end $$;
create or replace function public.stage_personnel_import(b text,f text,h text,sz integer,items jsonb,note text)
returns uuid language sql security invoker set search_path='' as $$select private.stage_personnel_import(b,f,h,sz,items,note);$$;

create or replace function private.review_personnel_import(r uuid,n jsonb,approve boolean,reason text)
returns void language plpgsql security definer set search_path='' as $$
declare rowdata public.import_rows;
begin
 select x.* into rowdata from public.import_rows x join public.import_batches b on b.id=x.batch_id and b.domain='personnel' where x.id=r for update of x;
 if not found or not private.has_role(rowdata.branch_code,array['admin']) then raise exception 'Akses pemeriksaan ditolak.' using errcode='42501';end if;
 if rowdata.decision='committed' then raise exception 'Baris telah diterapkan.';end if;
 if length(trim(reason))<8 or jsonb_typeof(n)<>'object' or octet_length(n::text)>20000 then raise exception 'Catatan atau koreksi tidak valid.';end if;
 update public.import_rows set normalized_values=rowdata.normalized_values||n,
  decision=case when approve then 'approved' else 'rejected' end,
  review_note=reason,reviewed_by=auth.uid(),reviewed_at=now() where id=r;
end $$;
create or replace function public.review_personnel_import(r uuid,n jsonb,approve boolean,reason text)
returns void language sql security invoker set search_path='' as $$select private.review_personnel_import(r,n,approve,reason);$$;

create or replace function private.approve_personnel_import_batch(batch uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare info public.import_batches;counted integer;
begin
 select * into info from public.import_batches where id=batch and domain='personnel' for update;
 if not found or not private.has_role(info.branch_code,array['admin']) then raise exception 'Akses persetujuan ditolak.' using errcode='42501';end if;
 update public.import_rows set decision='approved',review_note='Pencocokan otomatis diperiksa dan disetujui sekaligus melalui halaman impor.',reviewed_by=auth.uid(),reviewed_at=now()
 where batch_id=batch and decision='pending' and review_status='ready';
 get diagnostics counted=row_count;
 return counted;
end $$;
create or replace function public.approve_personnel_import_batch(batch uuid)
returns integer language sql security invoker set search_path='' as $$select private.approve_personnel_import_batch(batch);$$;

create or replace function private.commit_personnel_certificate_import(batch uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare info public.import_batches;r public.import_rows;n jsonb;target uuid;eid uuid;current_record public.personnel_certificates;cnt integer:=0;intent boolean;process_id uuid;
begin
 select * into info from public.import_batches where id=batch and domain='personnel' for update;
 if not found or not private.has_role(info.branch_code,array['admin']) then raise exception 'Akses impor kompetensi ditolak.' using errcode='42501';end if;
 for r in select * from public.import_rows where batch_id=batch and decision='approved' order by source_row,id for update loop
  if r.reviewed_by is null then raise exception 'Persetujuan pengguna diperlukan.';end if;
  n:=r.normalized_values;eid:=nullif(n->>'employee_id','')::uuid;target:=nullif(n->>'target_certificate_id','')::uuid;
  if eid is null or nullif(n->>'certificate_type_id','') is null or length(trim(coalesce(n->>'original_title','')))<2 then raise exception 'Pegawai, jenis kompetensi, dan judul lisensi wajib cocok.';end if;
  if target is not null then
   select * into current_record from public.personnel_certificates where id=target and branch_code=info.branch_code and employee_id=eid for update;
   if not found then raise exception 'Sertifikat tujuan tidak ditemukan pada pegawai yang dipilih.';end if;
  else
   select * into current_record from public.personnel_certificates c where c.branch_code=info.branch_code and c.employee_id=eid
    and ((nullif(n->>'existing_certificate_number','') is not null and lower(regexp_replace(coalesce(c.certificate_number,''),'[^a-z0-9]','','g'))=lower(regexp_replace(n->>'existing_certificate_number','[^a-z0-9]','','g')))
      or (nullif(n->>'existing_certificate_number','') is null and nullif(n->>'certificate_number','') is not null and lower(regexp_replace(coalesce(c.certificate_number,''),'[^a-z0-9]','','g'))=lower(regexp_replace(n->>'certificate_number','[^a-z0-9]','','g'))))
    order by c.created_at desc limit 1 for update;
   target:=current_record.id;
  end if;
  if target is null then
   insert into public.personnel_certificates(employee_id,certificate_type_id,original_title,original_holder_name,issuer,certificate_number,issue_date,expiry_date,interval_months,validity_kind,source_folder_url,source_provider,notes,branch_code,verification_status,source_import_row_id)
   values(eid,(n->>'certificate_type_id')::uuid,n->>'original_title',nullif(n->>'original_holder_name',''),nullif(n->>'issuer',''),nullif(n->>'certificate_number',''),nullif(n->>'issue_date','')::date,nullif(n->>'expiry_date','')::date,nullif(n->>'interval_months','')::integer,coalesce(nullif(n->>'validity_kind',''),'term'),nullif(n->>'source_folder_url',''),case when nullif(n->>'source_folder_url','') is not null then 'google_drive_folder' end,nullif(n->>'notes',''),info.branch_code,'pending',r.id) returning id into target;
  else
   update public.personnel_certificates c set
    certificate_type_id=(n->>'certificate_type_id')::uuid,
    original_title=n->>'original_title',
    original_holder_name=coalesce(nullif(n->>'original_holder_name',''),c.original_holder_name),
    issuer=coalesce(nullif(n->>'issuer',''),c.issuer),
    certificate_number=coalesce(nullif(n->>'certificate_number',''),c.certificate_number),
    issue_date=coalesce(nullif(n->>'issue_date','')::date,c.issue_date),
    expiry_date=case when n->>'validity_kind'='lifetime' then null else coalesce(nullif(n->>'expiry_date','')::date,c.expiry_date) end,
    interval_months=case when n->>'validity_kind'='lifetime' then null else coalesce(nullif(n->>'interval_months','')::integer,c.interval_months) end,
    validity_kind=coalesce(nullif(n->>'validity_kind',''),c.validity_kind),
    source_folder_url=coalesce(nullif(n->>'source_folder_url',''),c.source_folder_url),
    source_provider=case when coalesce(nullif(n->>'source_folder_url',''),c.source_folder_url) is not null then 'google_drive_folder' end,
    notes=coalesce(nullif(n->>'notes',''),c.notes)
   where c.id=target;
  end if;
  select * into current_record from public.personnel_certificates where id=target for update;
  intent=coalesce(n->>'renewal_intent','')='processing';
  if current_record.validity_kind='term' and current_record.expiry_date>(now() at time zone 'Asia/Makassar')::date+90 then
   update public.personnel_certificates set notes=private.clean_personnel_renewal_note(notes) where id=target;
  elsif current_record.validity_kind='term' and current_record.expiry_date is not null and intent then
   select id into process_id from public.personnel_renewal_cases where certificate_id=target and branch_code=info.branch_code and history_deleted_at is null for update;
   if process_id is null then
    insert into public.personnel_renewal_cases(branch_code,certificate_id,status,notes)
    values(info.branch_code,target,'processing','Dibuat otomatis dari keterangan pada impor kompetensi personil.') returning id into process_id;
   else
    update public.personnel_renewal_cases set status='processing',notes='Diperbarui otomatis dari keterangan pada impor kompetensi personil.' where id=process_id and status='unprocessed';
   end if;
  end if;
  update public.import_rows set decision='committed',committed_record_id=target where id=r.id;cnt:=cnt+1;
 end loop;
 insert into public.audit_logs(table_name,record_id,action,actor_id,new_values,branch_code,database_actor)
 values('import_batches',batch::text,'UPDATE',auth.uid(),jsonb_build_object('committed_count',cnt,'domain','personnel'),info.branch_code,session_user);
 return cnt;
end $$;
create or replace function public.commit_personnel_certificate_import(batch uuid)
returns integer language sql security invoker set search_path='' as $$select private.commit_personnel_certificate_import(batch);$$;

revoke all on function private.stage_personnel_import(text,text,text,integer,jsonb,text),private.review_personnel_import(uuid,jsonb,boolean,text),private.approve_personnel_import_batch(uuid),private.commit_personnel_certificate_import(uuid),public.stage_personnel_import(text,text,text,integer,jsonb,text),public.review_personnel_import(uuid,jsonb,boolean,text),public.approve_personnel_import_batch(uuid),public.commit_personnel_certificate_import(uuid) from public,anon,authenticated;
grant execute on function private.stage_personnel_import(text,text,text,integer,jsonb,text),private.review_personnel_import(uuid,jsonb,boolean,text),private.approve_personnel_import_batch(uuid),private.commit_personnel_certificate_import(uuid),public.stage_personnel_import(text,text,text,integer,jsonb,text),public.review_personnel_import(uuid,jsonb,boolean,text),public.approve_personnel_import_batch(uuid),public.commit_personnel_certificate_import(uuid) to authenticated;
