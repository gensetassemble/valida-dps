-- Phase 03+04: additive operational fields, private staging and secured evidence.
alter table public.employee_directory add column employment_category text check(employment_category in ('PT','PTT_REGULAR','PTT_PROJECT','LS','unknown')), add column organization_unit text, add column source_nrk_label text;
alter table public.clients add column is_example boolean not null default false, add column example_am_label text;
alter table public.client_certificates add column interval_months integer check(interval_months between 1 and 600),add column notes text,add column is_active boolean not null default true,add column is_example boolean not null default false,add column previous_certificate_id uuid references public.client_certificates(id);
alter table public.personnel_certificates add column original_title text,add column original_holder_name text,add column notes text,add column interval_months integer check(interval_months between 1 and 600),add column validity_kind text not null default 'term' check(validity_kind in ('term','lifetime')),add column source_folder_url text,add column source_provider text check(source_provider in ('google_drive_folder')),add column is_active boolean not null default true,
 add constraint personnel_lifetime_dates check(validity_kind<>'lifetime' or (expiry_date is null and interval_months is null)),
 add constraint personnel_verified_term_date check(verification_status<>'verified' or validity_kind='lifetime' or expiry_date is not null),
 add constraint personnel_drive_url check(source_folder_url is null or source_folder_url ~ '^https://drive[.]google[.]com/drive/(u/[0-9]+/)?folders/[A-Za-z0-9_-]+([/?].*)?$');
alter table public.equipment add column notes text,add column verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected')),add column verified_at timestamptz,add column verified_by uuid references public.profiles(id);
alter table public.calibrations add column reported_due_date date,add column calculated_due_date date,add column calculation_base text check(calculation_base in ('calibration_date','issue_date')),add column resolution_note text,add column notes text,add column is_active boolean not null default true,
 add constraint verified_calibration_evidence check(verification_status<>'verified' or (result is not null and due_date is not null and date_basis is not null and length(trim(coalesce(date_source,'')))>=3)),
 add constraint calibration_date_conflict check(verification_status<>'verified' or reported_due_date is null or calculated_due_date is null or reported_due_date=calculated_due_date or length(trim(coalesce(resolution_note,'')))>=8);
create index equipment_verified_by_idx on public.equipment(verified_by);
create index certificates_previous_idx on public.client_certificates(previous_certificate_id);
create index calibrations_latest_idx on public.calibrations(equipment_id,calibration_date desc,created_at desc,id desc) where is_active;
create index personnel_employee_active_idx on public.personnel_certificates(employee_id,is_active);
create index client_cert_expiry_idx on public.client_certificates(branch_code,expiry_date) where is_active;

create function public.validity_status(d date,v text,kind text default 'term') returns text language sql stable security invoker set search_path='' as $$
 select case when v<>'verified' then 'Perlu Verifikasi' when kind='lifetime' then 'Berlaku Seumur Hidup' when d is null then 'Perlu Verifikasi'
 when d<(now() at time zone 'Asia/Makassar')::date then 'Kedaluwarsa' when d<=(now() at time zone 'Asia/Makassar')::date+30 then 'Kritis'
 when d<=(now() at time zone 'Asia/Makassar')::date+60 then 'Perhatian' when d<=(now() at time zone 'Asia/Makassar')::date+90 then 'Pantau' else 'Aman' end;
$$;
revoke all on function public.validity_status(date,text,text) from public,anon;
grant execute on function public.validity_status(date,text,text) to authenticated;
create view public.client_certificate_records with(security_invoker=true) as
 select c.*,cl.name as client_name,cl.account_manager_id,cl.example_am_label,cl.work_area_id,coalesce(c.portfolio_id,cl.portfolio_id) as scope_portfolio_id,
 ty.name as certificate_type_name,public.validity_status(c.expiry_date,c.verification_status) as validity_status,
 c.expiry_date-(now() at time zone 'Asia/Makassar')::date as days_remaining
 from public.client_certificates c join public.clients cl on cl.id=c.client_id join public.certificate_types ty on ty.id=c.certificate_type_id;
create view public.personnel_certificate_records with(security_invoker=true) as
 select c.*,e.full_name as employee_name,e.npp,ty.name as certificate_type_name,public.validity_status(c.expiry_date,c.verification_status,c.validity_kind) as validity_status,
 case when c.validity_kind='term' then c.expiry_date-(now() at time zone 'Asia/Makassar')::date end as days_remaining
 from public.personnel_certificates c join public.employee_directory e on e.id=c.employee_id join public.certificate_types ty on ty.id=c.certificate_type_id;
create view public.calibration_records with(security_invoker=true) as
 select c.*,e.name as equipment_name,public.validity_status(c.due_date,c.verification_status) as validity_status,c.due_date-(now() at time zone 'Asia/Makassar')::date as days_remaining
 from public.calibrations c join public.equipment e on e.id=c.equipment_id;
create view public.equipment_records with(security_invoker=true) as
 select e.*,l.id as latest_calibration_id,l.due_date as latest_due_date,
 case when e.verification_status<>'verified' then 'Perlu Verifikasi'
 when v.result='tidak_layak' or v.due_date<(now() at time zone 'Asia/Makassar')::date then 'Tidak Layak Pakai'
 when l.verification_status<>'verified' then 'Kalibrasi Terbaru Belum Diverifikasi'
 when l.result='layak' and l.due_date>=(now() at time zone 'Asia/Makassar')::date then 'Layak Pakai' else 'Perlu Verifikasi' end as eligibility_status,
 public.validity_status(l.due_date,case when e.verification_status='verified' then l.verification_status else 'pending' end) as validity_status
 from public.equipment e
 left join lateral(select c.* from public.calibrations c where c.equipment_id=e.id and c.is_active order by c.calibration_date desc nulls last,c.created_at desc,c.id desc limit 1) l on true
 left join lateral(select c.* from public.calibrations c where c.equipment_id=e.id and c.is_active and c.verification_status='verified' order by c.calibration_date desc nulls last,c.created_at desc,c.id desc limit 1) v on true;
revoke all on public.client_certificate_records,public.personnel_certificate_records,public.equipment_records,public.calibration_records from public,anon,authenticated;
grant select on public.client_certificate_records,public.personnel_certificate_records,public.equipment_records,public.calibration_records to authenticated;

create table public.import_batches(
 id uuid primary key default gen_random_uuid(),branch_code text not null references public.branches(code),domain text not null check(domain in ('employees','personnel','calibrations','clients')),
 filename text not null check(length(filename)<=180),file_hash text not null check(file_hash ~ '^[0-9a-f]{64}$'),file_bytes integer not null check(file_bytes between 1 and 5242880),
 source_count integer not null check(source_count between 1 and 2500),source_note text,
 created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),unique(branch_code,domain,file_hash),unique(id,branch_code)
);
create table public.import_rows(
 id uuid primary key default gen_random_uuid(),batch_id uuid not null,branch_code text not null references public.branches(code),
 source_sheet text not null,source_row integer not null check(source_row>0),raw_values jsonb not null,normalized_values jsonb not null,
 issues jsonb not null default '[]',review_status text not null default 'needs_review' check(review_status in ('ready','needs_review','invalid','duplicate','conflict')),
 decision text not null default 'pending' check(decision in ('pending','approved','rejected','committed')),review_note text,reviewed_by uuid references auth.users(id) on delete set null,reviewed_at timestamptz,
 committed_record_id uuid,created_at timestamptz not null default now(),foreign key(batch_id,branch_code) references public.import_batches(id,branch_code),unique(batch_id,source_sheet,source_row)
);
create index import_batches_creator_idx on public.import_batches(created_by);
create index import_rows_branch_idx on public.import_rows(branch_code);
create index import_rows_reviewed_by_idx on public.import_rows(reviewed_by);
create index import_rows_decisions_idx on public.import_rows(batch_id,decision);
alter table public.import_batches enable row level security;alter table public.import_rows enable row level security;
revoke all on public.import_batches,public.import_rows from public,anon,authenticated;
grant select on public.import_batches,public.import_rows to authenticated;
create policy batches_admin_read on public.import_batches for select to authenticated using(private.has_role(branch_code,array['admin']));
create policy rows_admin_read on public.import_rows for select to authenticated using(private.has_role(branch_code,array['admin']));
alter table public.personnel_certificates add column source_import_row_id uuid unique references public.import_rows(id);
alter table public.calibrations add column source_import_row_id uuid unique references public.import_rows(id);
alter table public.client_certificates add column source_import_row_id uuid unique references public.import_rows(id);

-- Privileged internal writers are not Data API RPCs. Public wrappers are invoker functions.
create function private.stage_import(b text,d text,f text,h text,sz integer,items jsonb,note text) returns uuid language plpgsql security definer set search_path='' as $$
declare batch uuid; item jsonb;
begin
 if not private.has_role(b,array['admin']) then raise exception 'Admin cabang diperlukan.' using errcode='42501'; end if;
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items) not between 1 and 2500 or octet_length(items::text)>10485760 then raise exception 'Ukuran staging tidak valid.'; end if;
 insert into public.import_batches(branch_code,domain,filename,file_hash,file_bytes,source_count,created_by,source_note)
 values(b,d,f,h,sz,jsonb_array_length(items),auth.uid(),note) on conflict(branch_code,domain,file_hash) do nothing returning id into batch;
 if batch is null then select id into batch from public.import_batches where branch_code=b and domain=d and file_hash=h;return batch;end if;
 for item in select value from jsonb_array_elements(items) loop
 insert into public.import_rows(batch_id,branch_code,source_sheet,source_row,raw_values,normalized_values,issues,review_status)
 values(batch,b,left(item->>'sheet',120),(item->>'row')::integer,item->'raw',item->'normalized',coalesce(item->'issues','[]'),coalesce(item->>'status','needs_review'));
 end loop;
 insert into public.audit_logs(table_name,record_id,action,actor_id,new_values,branch_code,database_actor) values('import_batches',batch::text,'INSERT',auth.uid(),jsonb_build_object('source_count',jsonb_array_length(items),'domain',d),b,session_user);
 return batch;
end $$;
create function public.stage_import(b text,d text,f text,h text,sz integer,items jsonb,note text) returns uuid language sql security invoker set search_path='' as $$ select private.stage_import(b,d,f,h,sz,items,note); $$;

create function private.review_import(r uuid,n jsonb,approve boolean,reason text) returns void language plpgsql security definer set search_path='' as $$
declare rowdata public.import_rows;
begin
 select * into rowdata from public.import_rows where id=r for update;
 if not found or not private.has_role(rowdata.branch_code,array['admin']) then raise exception 'Akses review ditolak.' using errcode='42501';end if;
 if rowdata.decision='committed' then raise exception 'Baris telah diimpor.';end if;
 if length(trim(reason))<8 or jsonb_typeof(n)<>'object' or octet_length(n::text)>20000 then raise exception 'Alasan atau koreksi tidak valid.';end if;
 update public.import_rows set normalized_values=n,decision=case when approve then 'approved' else 'rejected' end,review_note=reason,reviewed_by=auth.uid(),reviewed_at=now() where id=r;
 insert into public.audit_logs(table_name,record_id,action,actor_id,old_values,new_values,branch_code,database_actor) values('import_rows',r::text,'UPDATE',auth.uid(),jsonb_build_object('decision',rowdata.decision),jsonb_build_object('decision',case when approve then 'approved' else 'rejected' end),rowdata.branch_code,session_user);
end $$;
create function public.review_import(r uuid,n jsonb,approve boolean,reason text) returns void language sql security invoker set search_path='' as $$ select private.review_import(r,n,approve,reason); $$;

create function private.commit_import(batch uuid) returns integer language plpgsql security definer set search_path='' as $$
declare info public.import_batches;r public.import_rows;n jsonb;target uuid;eid uuid;num text;nm text;cnt integer:=0;
begin
 select * into info from public.import_batches where id=batch for update;
 if not found or not private.has_role(info.branch_code,array['admin']) then raise exception 'Akses impor ditolak.' using errcode='42501';end if;
 for r in select * from public.import_rows where batch_id=batch and decision='approved' order by source_row,id for update loop
  if r.reviewed_by is null then raise exception 'Persetujuan manusia diperlukan.';end if;
  n:=r.normalized_values;target:=null;
  if info.domain='employees' then
   num:=n->>'npp';nm:=trim(n->>'full_name');
   if num !~ '^[0-9]{5}$' or length(coalesce(nm,''))<2 or coalesce(n->>'employment_category','') not in ('PT','PTT_REGULAR','PTT_PROJECT','LS') then raise exception 'Identitas pegawai belum terpetakan.';end if;
   select id into target from public.employee_directory where branch_code=info.branch_code and npp=num for update;
   if target is not null then
    if not exists(select 1 from public.employee_directory where id=target and lower(trim(full_name))=lower(nm)) then raise exception 'Konflik NRK dan nama pegawai.';end if;
   else
    if exists(select 1 from public.employee_directory where branch_code=info.branch_code and lower(trim(full_name))=lower(nm)) then raise exception 'Nama sudah ada; cocokkan identitas sebelum impor.';end if;
    insert into public.employee_directory(full_name,npp,branch_code,employment_category,organization_unit,source_nrk_label,employment_status,verification_status,is_active)
    values(nm,num,info.branch_code,n->>'employment_category',n->>'organization_unit','NRK','unknown','pending',false) returning id into target;
   end if;
  elsif info.domain='personnel' then
   eid:=(n->>'employee_id')::uuid;
   if eid is null or (n->>'certificate_type_id') is null or length(trim(coalesce(n->>'original_title','')))<2 then raise exception 'Pegawai dan jenis lisensi wajib dipetakan.';end if;
   if exists(select 1 from public.personnel_certificates c where c.employee_id=eid and c.certificate_number is not null and c.certificate_number=nullif(n->>'certificate_number','') and lower(coalesce(c.issuer,''))=lower(coalesce(n->>'issuer',''))) then raise exception 'Kemungkinan sertifikat duplikat; tinjau dahulu.';end if;
   insert into public.personnel_certificates(employee_id,certificate_type_id,original_title,original_holder_name,issuer,certificate_number,issue_date,expiry_date,interval_months,validity_kind,source_folder_url,source_provider,notes,branch_code,verification_status,source_import_row_id)
   values(eid,(n->>'certificate_type_id')::uuid,n->>'original_title',n->>'original_holder_name',nullif(n->>'issuer',''),nullif(n->>'certificate_number',''),nullif(n->>'issue_date','')::date,nullif(n->>'expiry_date','')::date,nullif(n->>'interval_months','')::integer,coalesce(n->>'validity_kind','term'),nullif(n->>'source_folder_url',''),case when nullif(n->>'source_folder_url','') is not null then 'google_drive_folder' end,n->>'notes',info.branch_code,'pending',r.id) returning id into target;
  elsif info.domain='calibrations' then
   eid:=(n->>'equipment_id')::uuid;
   if eid is null then raise exception 'Aset harus dipetakan; kepemilikan tidak boleh ditebak.';end if;
   if exists(select 1 from public.calibrations c where c.equipment_id=eid and c.calibration_date is not distinct from nullif(n->>'calibration_date','')::date and coalesce(c.certificate_number,'')=coalesce(n->>'certificate_number','') and coalesce(c.laboratory,'')=coalesce(n->>'laboratory','')) then raise exception 'Kemungkinan peristiwa kalibrasi duplikat.';end if;
   insert into public.calibrations(equipment_id,laboratory,certificate_number,calibration_date,issue_date,due_date,reported_due_date,interval_months,date_basis,date_source,notes,branch_code,verification_status,result,source_import_row_id)
   values(eid,nullif(n->>'laboratory',''),nullif(n->>'certificate_number',''),nullif(n->>'calibration_date','')::date,nullif(n->>'issue_date','')::date,nullif(n->>'due_date','')::date,nullif(n->>'due_date','')::date,nullif(n->>'interval_months','')::integer,'unverified','Sumber impor belum diverifikasi',n->>'notes',info.branch_code,'pending',null,r.id) returning id into target;
  elsif info.domain='clients' then
   if n->>'client_id' is null or n->>'certificate_type_id' is null then raise exception 'Pelanggan dan jenis sertifikat wajib dipetakan.';end if;
   insert into public.client_certificates(client_id,certificate_type_id,certificate_number,object_type,object_serial,installation_location,order_reference,contract_reference,issue_date,expiry_date,interval_months,previous_order_value,branch_code,verification_status,source_import_row_id)
   values((n->>'client_id')::uuid,(n->>'certificate_type_id')::uuid,n->>'certificate_number',n->>'object_type',n->>'object_serial',n->>'installation_location',n->>'order_reference',n->>'contract_reference',nullif(n->>'issue_date','')::date,nullif(n->>'expiry_date','')::date,nullif(n->>'interval_months','')::integer,nullif(n->>'previous_order_value','')::numeric,info.branch_code,'pending',r.id) returning id into target;
  end if;
  if target is null then raise exception 'Tidak ada target impor yang tersimpan.';end if;
  update public.import_rows set decision='committed',committed_record_id=target where id=r.id;cnt:=cnt+1;
 end loop;
 insert into public.audit_logs(table_name,record_id,action,actor_id,new_values,branch_code,database_actor) values('import_batches',batch::text,'UPDATE',auth.uid(),jsonb_build_object('committed_count',cnt),info.branch_code,session_user);
 return cnt;
end $$;
create function public.commit_import(batch uuid) returns integer language sql security invoker set search_path='' as $$select private.commit_import(batch);$$;
revoke all on function private.stage_import(text,text,text,text,integer,jsonb,text),private.review_import(uuid,jsonb,boolean,text),private.commit_import(uuid),public.stage_import(text,text,text,text,integer,jsonb,text),public.review_import(uuid,jsonb,boolean,text),public.commit_import(uuid) from public,anon,authenticated;
grant execute on function private.stage_import(text,text,text,text,integer,jsonb,text),private.review_import(uuid,jsonb,boolean,text),private.commit_import(uuid),public.stage_import(text,text,text,text,integer,jsonb,text),public.review_import(uuid,jsonb,boolean,text),public.commit_import(uuid) to authenticated;

-- Corrections are proposals, never self-approval of an official license.
create table public.personnel_correction_requests(
 id uuid primary key default gen_random_uuid(),certificate_id uuid not null references public.personnel_certificates(id),branch_code text not null references public.branches(code),
 message text not null check(length(trim(message)) between 8 and 2000),created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default now()
);
create index correction_cert_idx on public.personnel_correction_requests(certificate_id);
create index correction_branch_idx on public.personnel_correction_requests(branch_code);
create index correction_actor_idx on public.personnel_correction_requests(created_by);
alter table public.personnel_correction_requests enable row level security;revoke all on public.personnel_correction_requests from public,anon,authenticated;grant select,insert on public.personnel_correction_requests to authenticated;
create policy corrections_read on public.personnel_correction_requests for select to authenticated using(created_by=(select auth.uid()) or private.has_role(branch_code,array['admin','hrga']));
create policy corrections_insert on public.personnel_correction_requests for insert to authenticated with check(created_by=(select auth.uid()) and exists(select 1 from public.personnel_certificates c where c.id=certificate_id and c.branch_code=personnel_correction_requests.branch_code));

-- Evidence metadata is authorized through its real business parent.
create function private.document_scope(b text,d text,r uuid,w boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select case d when 'client' then exists(select 1 from public.client_certificates c where c.id=r and c.branch_code=b and private.client_scope(b,c.client_id,w))
 when 'personnel' then exists(select 1 from public.personnel_certificates c where c.id=r and c.branch_code=b and case when w then private.has_role(b,array['admin','hrga']) else private.employee_scope(b,c.employee_id) end)
 when 'calibration' then exists(select 1 from public.calibrations c where c.id=r and c.branch_code=b and private.equipment_scope(b,c.equipment_id,w)) else false end;
$$;
revoke all on function private.document_scope(text,text,uuid,boolean) from public,anon;grant execute on function private.document_scope(text,text,uuid,boolean) to authenticated;
create table public.operational_documents(
 id uuid primary key default gen_random_uuid(),branch_code text not null references public.branches(code),domain text not null check(domain in ('client','personnel','calibration')),record_id uuid not null,
 kind text not null check(kind in ('certificate','quotation','purchase_order')),object_path text not null unique,original_name text not null check(length(original_name)<=180),file_bytes integer not null check(file_bytes between 1 and 10485760),
 created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default now(),
 check(object_path=branch_code||'/'||domain||'/'||record_id::text||'/'||id::text||'.pdf')
);
create index document_branch_idx on public.operational_documents(branch_code);
create index document_record_idx on public.operational_documents(domain,record_id);
create index document_actor_idx on public.operational_documents(created_by);
alter table public.operational_documents enable row level security;revoke all on public.operational_documents from public,anon,authenticated;grant select,insert on public.operational_documents to authenticated;
create policy documents_read on public.operational_documents for select to authenticated using(private.document_scope(branch_code,domain,record_id));
create policy documents_insert on public.operational_documents for insert to authenticated with check(created_by=(select auth.uid()) and private.document_scope(branch_code,domain,record_id,true));
-- The restrictive policy continues to deny orphan/unauthorized paths even if other policies exist.
drop policy certificate_documents_closed on storage.objects;
create policy certificate_documents_closed on storage.objects as restrictive for all to anon,authenticated
 using(bucket_id<>'certificate-documents' or exists(select 1 from public.operational_documents d where d.object_path=name))
 with check(bucket_id<>'certificate-documents' or exists(select 1 from public.operational_documents d where d.object_path=name and private.document_scope(d.branch_code,d.domain,d.record_id,true)));
create policy operational_pdf_read on storage.objects for select to authenticated using(bucket_id='certificate-documents' and exists(select 1 from public.operational_documents d where d.object_path=name));
create policy operational_pdf_insert on storage.objects for insert to authenticated with check(bucket_id='certificate-documents' and exists(select 1 from public.operational_documents d where d.object_path=name and private.document_scope(d.branch_code,d.domain,d.record_id,true)));

create table public.renewal_opportunities(
 id uuid primary key default gen_random_uuid(),certificate_id uuid not null unique references public.client_certificates(id),client_id uuid not null,branch_code text not null references public.branches(code),
 stage text not null default 'uncontacted' check(stage in ('uncontacted','contacted','offered','po_received','deferred','not_renewed')),updated_at timestamptz not null default now(),
 foreign key(client_id,branch_code) references public.clients(id,branch_code)
);
create table public.renewal_events(
 id uuid primary key default gen_random_uuid(),opportunity_id uuid not null references public.renewal_opportunities(id),branch_code text not null references public.branches(code),from_stage text,to_stage text not null,
 note text not null check(length(trim(note)) between 8 and 2000),document_id uuid references public.operational_documents(id),created_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index renewal_client_idx on public.renewal_opportunities(client_id,branch_code);
create index renewal_branch_idx on public.renewal_opportunities(branch_code);
create index renewal_events_parent_idx on public.renewal_events(opportunity_id);
create index renewal_events_branch_idx on public.renewal_events(branch_code);
create index renewal_events_doc_idx on public.renewal_events(document_id);
create index renewal_events_actor_idx on public.renewal_events(created_by);
alter table public.renewal_opportunities enable row level security;alter table public.renewal_events enable row level security;
revoke all on public.renewal_opportunities,public.renewal_events from public,anon,authenticated;grant select on public.renewal_opportunities,public.renewal_events to authenticated;
create policy renewal_read on public.renewal_opportunities for select to authenticated using(private.client_scope(branch_code,client_id));
create policy renewal_events_read on public.renewal_events for select to authenticated using(exists(select 1 from public.renewal_opportunities o where o.id=opportunity_id and o.branch_code=renewal_events.branch_code));
create function private.transition_renewal(cert uuid,target text,note text,doc uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.client_certificates;o public.renewal_opportunities;required_kind text;
begin
 select * into c from public.client_certificates where id=cert;
 if not found or not private.client_scope(c.branch_code,c.client_id,true) then raise exception 'Akses pipeline ditolak.' using errcode='42501';end if;
 if c.is_example then raise exception 'Data contoh tidak dapat dicatat sebagai aktivitas komersial riil.';end if;
 if length(trim(note)) not between 8 and 2000 then raise exception 'Catatan kontak/alasan diperlukan.';end if;
 insert into public.renewal_opportunities(certificate_id,client_id,branch_code) values(c.id,c.client_id,c.branch_code) on conflict(certificate_id) do nothing;
 select * into o from public.renewal_opportunities where certificate_id=cert for update;
 if target='contacted' and o.stage='uncontacted' then null;
 elsif target='offered' and o.stage='contacted' then required_kind:='quotation';
 elsif target='po_received' and o.stage='offered' then required_kind:='purchase_order';
 elsif target in ('deferred','not_renewed') and o.stage in ('uncontacted','contacted','offered','deferred') and o.stage<>target then null;
 elsif target='contacted' and o.stage='deferred' then null;
 else raise exception 'Transisi ditolak oleh gerbang bisnis.';end if;
 if required_kind is not null and not exists(select 1 from public.operational_documents d join storage.objects s on s.name=d.object_path and s.bucket_id='certificate-documents'
 where d.id=doc and d.domain='client' and d.record_id=c.id and d.kind=required_kind and d.branch_code=c.branch_code) then raise exception 'PDF penawaran/PO yang telah diunggah wajib tersedia.';end if;
 update public.renewal_opportunities set stage=target,updated_at=now() where id=o.id;
 insert into public.renewal_events(opportunity_id,branch_code,from_stage,to_stage,note,document_id,created_by) values(o.id,c.branch_code,o.stage,target,note,doc,auth.uid());
 insert into public.audit_logs(table_name,record_id,action,actor_id,old_values,new_values,branch_code,database_actor) values('renewal_opportunities',o.id::text,'UPDATE',auth.uid(),jsonb_build_object('stage',o.stage),jsonb_build_object('stage',target),c.branch_code,session_user);
 return o.id;
end $$;
create function public.transition_renewal(cert uuid,target text,note text,doc uuid default null) returns uuid language sql security invoker set search_path='' as $$select private.transition_renewal(cert,target,note,doc);$$;
revoke all on function private.transition_renewal(uuid,text,text,uuid),public.transition_renewal(uuid,text,text,uuid) from public,anon;grant execute on function private.transition_renewal(uuid,text,text,uuid),public.transition_renewal(uuid,text,text,uuid) to authenticated;
