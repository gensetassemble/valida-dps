-- Additive operational workflows. Business contacts never grant account access.
create table public.portfolio_coordinators (
 id uuid primary key default gen_random_uuid(), branch_code text not null references public.branches(code),
 portfolio_id uuid not null, coordinator_id uuid not null references public.operational_coordinators(id),
 employee_id uuid, effective_from date not null default (now() at time zone 'Asia/Makassar')::date,
 effective_until date, is_active boolean not null default true, notes text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id),updated_by uuid references auth.users(id),
 foreign key(portfolio_id,branch_code) references public.portfolios(id,branch_code),
 foreign key(employee_id,branch_code) references public.employee_directory(id,branch_code),
 check(effective_until is null or effective_until>=effective_from)
);
create index portfolio_coordinators_lookup on public.portfolio_coordinators(branch_code,portfolio_id,effective_from);
create index portfolio_coordinators_contact on public.portfolio_coordinators(coordinator_id);
create index portfolio_coordinators_employee on public.portfolio_coordinators(employee_id);
create function private.guard_portfolio_coordinator() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.portfolio_id::text,197));
 if tg_op='UPDATE' and (new.portfolio_id is distinct from old.portfolio_id or new.coordinator_id is distinct from old.coordinator_id or new.employee_id is distinct from old.employee_id or new.effective_from<>old.effective_from) then
  raise exception 'Tutup periode lama dan buat penetapan koordinator baru; identitas penetapan dipertahankan.';
 end if;
 if not exists(select 1 from public.operational_coordinators c where c.id=new.coordinator_id and c.branch_code=new.branch_code and c.is_active) then raise exception 'Koordinator tidak aktif atau berbeda cabang.';end if;
 if new.is_active and exists(select 1 from public.portfolio_coordinators a where a.id<>new.id and a.branch_code=new.branch_code and a.portfolio_id=new.portfolio_id and a.is_active and daterange(a.effective_from,a.effective_until,'[]') && daterange(new.effective_from,new.effective_until,'[]')) then raise exception 'Periode koordinator utama tumpang tindih.';end if;
 return new;
end $$;
alter table public.equipment add column responsible_coordinator_assignment_id uuid references public.portfolio_coordinators(id),add column responsibility_override_reason text;
create index equipment_coordinator_assignment on public.equipment(responsible_coordinator_assignment_id);
create function private.assign_equipment_coordinator() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.portfolio_coordinators;
begin
 -- Existing snapshots remain unchanged when unrelated equipment fields are edited.
 if tg_op='UPDATE' and new.portfolio_id is not distinct from old.portfolio_id and new.responsible_employee_id is not distinct from old.responsible_employee_id and new.responsible_coordinator_assignment_id is not distinct from old.responsible_coordinator_assignment_id then return new;end if;
 select pc.* into a from public.portfolio_coordinators pc join public.operational_coordinators c on c.id=pc.coordinator_id and c.is_active where pc.branch_code=new.branch_code and pc.portfolio_id=new.portfolio_id and pc.is_active and pc.effective_from<=(now() at time zone 'Asia/Makassar')::date and (pc.effective_until is null or pc.effective_until>=(now() at time zone 'Asia/Makassar')::date);
 if new.responsible_employee_id is not null and new.responsible_employee_id is distinct from a.employee_id then
  if auth.uid() is not null and not private.has_role(new.branch_code,array['admin']) then raise exception 'Penanggung jawab mengikuti koordinator portofolio.' using errcode='42501';end if;
  if length(trim(coalesce(new.responsibility_override_reason,'')))<8 then raise exception 'Override memerlukan alasan administrator minimal 8 karakter.';end if;
 else new.responsible_employee_id:=a.employee_id;end if;
 new.responsible_coordinator_assignment_id:=a.id;
 return new;
end $$;
-- Runs after the existing record guard and before the audit trigger.
create trigger z_assign_equipment_coordinator before insert or update on public.equipment for each row execute function private.assign_equipment_coordinator();

create table public.calibration_requests (
 id uuid primary key default gen_random_uuid(),branch_code text not null references public.branches(code),
 equipment_id uuid not null, status text not null default 'draft' check(status in ('draft','awaiting_signatures','submitted','correction','accepted','completed','cancelled')),
 request_number text,unit_name text,quantity integer not null default 1 check(quantity between 1 and 10000),
 laboratory text,resolution_class text,estimated_days integer check(estimated_days between 0 and 10000),estimated_cost numeric check(estimated_cost>=0),
 requester_name text,supervisor_name text,requester_signed boolean not null default false,supervisor_signed boolean not null default false,
 signed_document_id uuid,calibration_id uuid references public.calibrations(id),notes text not null default '',
 equipment_snapshot jsonb not null default '{}',version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id),
 foreign key(equipment_id,branch_code) references public.equipment(id,branch_code)
);
create unique index calibration_request_one_active on public.calibration_requests(equipment_id) where status not in ('completed','cancelled');
create index calibration_requests_branch_status on public.calibration_requests(branch_code,status,created_at desc);
create index calibration_requests_calibration on public.calibration_requests(calibration_id);

create table public.personnel_renewal_cases (
 id uuid primary key default gen_random_uuid(),branch_code text not null references public.branches(code),
 certificate_id uuid not null unique references public.personnel_certificates(id),
 status text not null default 'unprocessed' check(status in ('unprocessed','processing','renewed')),
 replacement_certificate_id uuid references public.personnel_certificates(id),notes text not null default '',
 version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id)
);
create index personnel_renewal_branch_status on public.personnel_renewal_cases(branch_code,status,updated_at desc);
create unique index personnel_replacement_once on public.personnel_renewal_cases(replacement_certificate_id) where replacement_certificate_id is not null;

create table public.workflow_documents (
 id uuid primary key default gen_random_uuid(),branch_code text not null references public.branches(code),request_id uuid not null references public.calibration_requests(id),
 object_path text not null unique,original_name text not null,file_bytes integer not null check(file_bytes between 1 and 10485760),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id)
);
alter table public.calibration_requests add foreign key(signed_document_id) references public.workflow_documents(id);
create index workflow_documents_request on public.workflow_documents(request_id);
create index calibration_requests_signed_document on public.calibration_requests(signed_document_id);

create table public.calibration_request_events (
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.calibration_requests(id),branch_code text not null references public.branches(code),
 previous_status text,new_status text not null,notes text not null,actor_id uuid references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index calibration_request_events_parent on public.calibration_request_events(request_id,created_at);
create table public.personnel_renewal_events (
 id uuid primary key default gen_random_uuid(),case_id uuid not null references public.personnel_renewal_cases(id),branch_code text not null references public.branches(code),
 previous_status text,new_status text not null,notes text not null,actor_id uuid references auth.users(id),
 holder_delivery_available boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index personnel_renewal_events_parent on public.personnel_renewal_events(case_id,created_at);
create table public.user_notifications (
 id uuid primary key default gen_random_uuid(),branch_code text not null references public.branches(code),profile_id uuid not null references public.profiles(id),
 event_id uuid not null,title text not null,href text not null,read_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(profile_id,event_id)
);
create index user_notifications_inbox on public.user_notifications(profile_id,read_at,created_at desc);

create function private.calibration_request_scope(b text,e uuid,mode text default 'read') returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.has_role(b,array['admin']) or
 (mode='read' and private.equipment_scope(b,e,false)) or
 (mode='ptk' and private.has_role(b,array['equipment_manager']) and private.equipment_scope(b,e,true)) or
 (mode='requester' and private.has_role(b,array['coordinator']) and exists(select 1 from public.equipment x where x.id=e and x.branch_code=b and private.portfolio_scope(b,x.portfolio_id))));
$$;
create function private.personnel_renewal_scope(b text,c uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.personnel_certificates p where p.id=c and p.branch_code=b and private.employee_scope(b,p.employee_id));
$$;

create function private.guard_calibration_request() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.equipment;
begin
 if auth.uid() is null then raise exception 'Akun aktif diperlukan.' using errcode='42501';end if;
 if tg_op='INSERT' then
  if new.status<>'draft' or not private.calibration_request_scope(new.branch_code,new.equipment_id,'requester') then raise exception 'Permintaan harus dimulai sebagai draf oleh koordinator berwenang.' using errcode='42501';end if;
  select * into e from public.equipment where id=new.equipment_id and branch_code=new.branch_code and ownership='internal';
  if e.id is null then raise exception 'Alat internal tidak ditemukan.';end if;
  new.equipment_snapshot:=jsonb_build_object('name',e.name,'tag',e.tag,'asset_id',e.asset_id,'serial',e.serial,'brand',e.brand,'model',e.model,'location',e.location,'measurement_range',e.measurement_range,'specification_size',e.specification_size,'portfolio_id',e.portfolio_id,'responsible_assignment_id',e.responsible_coordinator_assignment_id);
  new.created_by:=auth.uid();new.created_at:=now();new.version:=1;
  new.signed_document_id:=null;new.calibration_id:=null;new.requester_signed:=false;new.supervisor_signed:=false;
 else
  if new.id<>old.id or new.branch_code<>old.branch_code or new.equipment_id<>old.equipment_id or new.created_by is distinct from old.created_by or new.equipment_snapshot<>old.equipment_snapshot then raise exception 'Identitas dan snapshot permintaan tetap.' using errcode='42501';end if;
  new.created_at:=old.created_at;new.version:=old.version+1;
  if old.status in ('completed','cancelled') then raise exception 'Permintaan sudah ditutup.';end if;
  if new.status=old.status then
   if old.status not in ('draft','awaiting_signatures','correction') or not private.calibration_request_scope(new.branch_code,new.equipment_id,'requester') then raise exception 'Draf tidak dapat diubah oleh akun ini.' using errcode='42501';end if;
  elsif (old.status in ('draft','correction') and new.status='awaiting_signatures') or (old.status in ('awaiting_signatures','correction') and new.status='submitted') or (new.status='cancelled' and old.status in ('draft','awaiting_signatures','correction')) then
   if not private.calibration_request_scope(new.branch_code,new.equipment_id,'requester') then raise exception 'Transisi pengaju ditolak.' using errcode='42501';end if;
  elsif (old.status='submitted' and new.status in ('accepted','correction')) or (old.status='accepted' and new.status in ('completed','correction','cancelled')) then
   if not private.calibration_request_scope(new.branch_code,new.equipment_id,'ptk') then raise exception 'Transisi PTK ditolak.' using errcode='42501';end if;
  else raise exception 'Urutan status permintaan tidak valid.';end if;
  if old.status in ('submitted','accepted') and (to_jsonb(new)-array['status','notes','calibration_id','version','updated_at','updated_by','created_at']) is distinct from (to_jsonb(old)-array['status','notes','calibration_id','version','updated_at','updated_by','created_at']) then raise exception 'PTK tidak boleh mengubah isi atau tanda tangan formulir pengaju.';end if;
 end if;
 if length(trim(new.notes))<8 then raise exception 'Catatan minimal 8 karakter.';end if;
 if new.status='submitted' then
  if length(trim(coalesce(new.request_number,'')))<2 or length(trim(coalesce(new.requester_name,'')))<2 or length(trim(coalesce(new.supervisor_name,'')))<2 or not new.requester_signed or not new.supervisor_signed or not exists(select 1 from public.workflow_documents d join storage.objects o on o.name=d.object_path and o.bucket_id='workflow-documents' where d.id=new.signed_document_id and d.request_id=new.id and d.branch_code=new.branch_code) then raise exception 'Nomor permintaan, nama pengaju/Kabid, konfirmasi dua tanda tangan dan PDF bertanda tangan wajib dilengkapi.';end if;
 end if;
 if new.calibration_id is not null and not exists(select 1 from public.calibrations c where c.id=new.calibration_id and c.branch_code=new.branch_code and c.equipment_id=new.equipment_id and c.created_at>=new.created_at and c.is_active) then raise exception 'Hasil harus berupa peristiwa kalibrasi baru untuk alat yang sama.';end if;
 if new.status='completed' and (new.calibration_id is null or not exists(select 1 from public.calibrations c where c.id=new.calibration_id and c.result is not null and c.certificate_number is not null and c.due_date is not null)) then raise exception 'Tautkan hasil kalibrasi baru yang memuat nomor sertifikat, tanggal akhir dan hasil sebelum selesai.';end if;
 new.updated_by:=auth.uid();new.updated_at:=now();return new;
end $$;

create function private.guard_personnel_renewal() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.personnel_certificates;r public.personnel_certificates;
begin
 if auth.uid() is null or not private.has_role(new.branch_code,array['admin','hrga']) then raise exception 'Pembaruan proses hanya oleh HRGA/administrator.' using errcode='42501';end if;
 select * into c from public.personnel_certificates where id=new.certificate_id and branch_code=new.branch_code;
 if c.id is null or c.validity_kind='lifetime' then raise exception 'Sertifikat tidak ditemukan atau berlaku seumur hidup.';end if;
 if length(trim(new.notes))<8 then raise exception 'Catatan proses minimal 8 karakter.';end if;
 if tg_op='INSERT' then
  if new.status<>'unprocessed' then raise exception 'Proses dimulai dari Belum Diproses.';end if;
  new.created_at:=now();new.created_by:=auth.uid();new.version:=1;
 else
  if new.id<>old.id or new.certificate_id<>old.certificate_id or new.branch_code<>old.branch_code or new.created_by is distinct from old.created_by then raise exception 'Identitas proses tetap.';end if;
  new.created_at:=old.created_at;new.version:=old.version+1;
  if old.status='renewed' then raise exception 'Proses sudah selesai; riwayat dipertahankan.';end if;
  if not (new.status=old.status or (old.status='unprocessed' and new.status='processing') or (old.status='processing' and new.status='renewed')) then raise exception 'Urutan gate HRGA tidak valid.';end if;
 end if;
 if new.status='renewed' then
  select * into r from public.personnel_certificates where id=new.replacement_certificate_id;
  if r.id is null or r.id=c.id or r.employee_id<>c.employee_id or r.branch_code<>c.branch_code or r.certificate_type_id<>c.certificate_type_id or not r.is_active or r.issue_date is null or r.certificate_number is null or (r.validity_kind='term' and (r.expiry_date is null or r.expiry_date<=coalesce(c.expiry_date,'0001-01-01'::date))) then raise exception 'Sertifikat pengganti harus milik pegawai dan jenis yang sama, lengkap, dengan masa berlaku baru.';end if;
  if not exists(select 1 from public.operational_documents d join storage.objects s on s.name=d.object_path and s.bucket_id='certificate-documents' where d.domain='personnel' and d.record_id=r.id and d.kind='certificate' and d.branch_code=r.branch_code) and r.source_folder_url is null then raise exception 'Bukti PDF atau referensi folder dokumen pengganti diperlukan.';end if;
 elsif new.replacement_certificate_id is not null then raise exception 'Tautan pengganti hanya diisi saat penyelesaian.';end if;
 new.updated_at:=now();new.updated_by:=auth.uid();return new;
end $$;

create function private.record_operational_workflow_event() returns trigger language plpgsql security definer set search_path='' as $$
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
  select exists(select 1 from public.profiles p where p.employee_id=holder and p.is_active and p.branch_code=new.branch_code and exists(select 1 from public.user_role_assignments g join public.roles ro on ro.code=g.role_code and ro.is_active where g.profile_id=p.id and g.branch_code=new.branch_code and g.is_active and g.revoked_at is null and g.role_code in ('inspector','hrga','admin','super_admin','branch_head','department_head','unit_head','tester'))) into available;
  insert into public.personnel_renewal_events(id,case_id,branch_code,previous_status,new_status,notes,actor_id,holder_delivery_available) values(event,new.id,new.branch_code,case when tg_op='UPDATE' then old.status end,new.status,new.notes,auth.uid(),available);
  link:='/kompetensi-personil/'||new.certificate_id::text||'?branch='||new.branch_code;
  title:='Status perpanjangan sertifikat: '||case new.status when 'processing' then 'Sedang Diproses' when 'renewed' then 'Sudah Diperpanjang' else 'Belum Diproses' end;
  insert into public.user_notifications(branch_code,profile_id,event_id,title,href)
  select distinct new.branch_code,p.id,event,title,link from public.profiles p where p.is_active and p.branch_code=new.branch_code and exists(select 1 from public.user_role_assignments g join public.roles ro on ro.code=g.role_code and ro.is_active where g.profile_id=p.id and g.branch_code=new.branch_code and g.is_active and g.revoked_at is null and (g.role_code in ('hrga','admin','super_admin') or (p.employee_id=holder and g.role_code in ('inspector','branch_head','department_head','unit_head','tester')) or (g.role_code in ('coordinator','qshe') and exists(select 1 from public.employee_portfolio_assignments recipient join public.employee_portfolio_assignments subject on subject.portfolio_id=recipient.portfolio_id and subject.branch_code=recipient.branch_code where recipient.employee_id=p.employee_id and recipient.branch_code=new.branch_code and recipient.assignment_type=g.role_code and recipient.is_active and recipient.verification_status='verified' and recipient.approved_at is not null and recipient.effective_from<=(now() at time zone 'Asia/Makassar')::date and (recipient.effective_until is null or recipient.effective_until>=(now() at time zone 'Asia/Makassar')::date) and subject.employee_id=holder and subject.is_active and subject.verification_status='verified' and subject.effective_from<=(now() at time zone 'Asia/Makassar')::date and (subject.effective_until is null or subject.effective_until>=(now() at time zone 'Asia/Makassar')::date))))) on conflict do nothing;
 end if;
 return new;
end $$;

-- RLS is authoritative; mutations use session-bound invoker functions.
do $$declare t text;begin
 foreach t in array array['portfolio_coordinators','calibration_requests','personnel_renewal_cases','workflow_documents','calibration_request_events','personnel_renewal_events','user_notifications'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
 foreach t in array array['portfolio_coordinators','calibration_requests','personnel_renewal_cases','workflow_documents'] loop
  execute format('create trigger audit_business_record after insert or update or delete on public.%I for each row execute function private.audit_business_record()',t);
 end loop;
end $$;
grant insert,update on public.portfolio_coordinators,public.calibration_requests,public.personnel_renewal_cases to authenticated;
grant insert on public.workflow_documents to authenticated;
grant update(read_at) on public.user_notifications to authenticated;
create policy primary_coordinator_read on public.portfolio_coordinators for select to authenticated using(private.branch_access(branch_code));
create policy primary_coordinator_insert on public.portfolio_coordinators for insert to authenticated with check(private.has_role(branch_code,array['admin']));
create policy primary_coordinator_update on public.portfolio_coordinators for update to authenticated using(private.has_role(branch_code,array['admin'])) with check(private.has_role(branch_code,array['admin']));
create trigger guard_record before insert or update on public.portfolio_coordinators for each row execute function private.guard_record();
create trigger z_guard_primary_coordinator before insert or update on public.portfolio_coordinators for each row execute function private.guard_portfolio_coordinator();
create policy calibration_requests_read on public.calibration_requests for select to authenticated using(private.calibration_request_scope(branch_code,equipment_id));
create policy calibration_requests_insert on public.calibration_requests for insert to authenticated with check(private.calibration_request_scope(branch_code,equipment_id,'requester'));
create policy calibration_requests_update on public.calibration_requests for update to authenticated using(private.calibration_request_scope(branch_code,equipment_id,'requester') or private.calibration_request_scope(branch_code,equipment_id,'ptk')) with check(private.calibration_request_scope(branch_code,equipment_id,'requester') or private.calibration_request_scope(branch_code,equipment_id,'ptk'));
create trigger guard_workflow before insert or update on public.calibration_requests for each row execute function private.guard_calibration_request();
create trigger workflow_event after insert or update on public.calibration_requests for each row execute function private.record_operational_workflow_event();
create policy personnel_renewal_read on public.personnel_renewal_cases for select to authenticated using(private.personnel_renewal_scope(branch_code,certificate_id));
create policy personnel_renewal_insert on public.personnel_renewal_cases for insert to authenticated with check(private.has_role(branch_code,array['admin','hrga']));
create policy personnel_renewal_update on public.personnel_renewal_cases for update to authenticated using(private.has_role(branch_code,array['admin','hrga'])) with check(private.has_role(branch_code,array['admin','hrga']));
create trigger guard_workflow before insert or update on public.personnel_renewal_cases for each row execute function private.guard_personnel_renewal();
create trigger workflow_event after insert or update on public.personnel_renewal_cases for each row execute function private.record_operational_workflow_event();
create policy calibration_events_read on public.calibration_request_events for select to authenticated using(exists(select 1 from public.calibration_requests r where r.id=request_id and r.branch_code=calibration_request_events.branch_code));
create policy renewal_events_read on public.personnel_renewal_events for select to authenticated using(exists(select 1 from public.personnel_renewal_cases r where r.id=case_id and r.branch_code=personnel_renewal_events.branch_code));
create policy workflow_documents_read on public.workflow_documents for select to authenticated using(exists(select 1 from public.calibration_requests r where r.id=request_id and r.branch_code=workflow_documents.branch_code));
create policy workflow_documents_insert on public.workflow_documents for insert to authenticated with check(object_path=branch_code||'/'||request_id::text||'/'||id::text||'.pdf' and exists(select 1 from public.calibration_requests r where r.id=request_id and r.branch_code=workflow_documents.branch_code and r.status in ('draft','awaiting_signatures','correction') and private.calibration_request_scope(r.branch_code,r.equipment_id,'requester')));
create trigger guard_record before insert on public.workflow_documents for each row execute function private.guard_record();
create policy notifications_read on public.user_notifications for select to authenticated using(profile_id=(select auth.uid()) and private.actor_enabled() and private.branch_access(branch_code));
create policy notifications_mark_read on public.user_notifications for update to authenticated using(profile_id=(select auth.uid()) and private.actor_enabled() and private.branch_access(branch_code)) with check(profile_id=(select auth.uid()) and private.actor_enabled() and private.branch_access(branch_code));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('workflow-documents','workflow-documents',false,10485760,array['application/pdf']) on conflict(id) do nothing;
create policy workflow_pdf_read on storage.objects for select to authenticated using(bucket_id='workflow-documents' and exists(select 1 from public.workflow_documents d where d.object_path=name));
create policy workflow_pdf_insert on storage.objects for insert to authenticated with check(bucket_id='workflow-documents' and exists(select 1 from public.workflow_documents d join public.calibration_requests r on r.id=d.request_id where d.object_path=name and r.status in ('draft','awaiting_signatures','correction') and private.calibration_request_scope(r.branch_code,r.equipment_id,'requester')));
-- Existing restrictive certificate policy only concerns its own bucket.

revoke all on function private.guard_portfolio_coordinator(),private.assign_equipment_coordinator(),private.guard_calibration_request(),private.guard_personnel_renewal(),private.record_operational_workflow_event() from public,anon,authenticated;
revoke all on function private.calibration_request_scope(text,uuid,text),private.personnel_renewal_scope(text,uuid) from public,anon;
grant execute on function private.calibration_request_scope(text,uuid,text),private.personnel_renewal_scope(text,uuid) to authenticated;
