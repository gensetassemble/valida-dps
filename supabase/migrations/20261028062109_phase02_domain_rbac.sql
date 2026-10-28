-- Phase 02. Additive development migration; legacy role_code is retained as history only.
alter table public.branches rename column branch_code to code;
alter table public.branches add column region text, add column is_active boolean not null default true,
  add column created_at timestamptz not null default now(), add column updated_at timestamptz not null default now();
alter table public.roles add column description text, add column is_active boolean not null default true;
update public.roles set is_active=false, description='Role tahap 01; tidak memberikan kewenangan tahap 02.' where code='member';
insert into public.roles(code,name,description) values
 ('account_manager','Account Manager / Marketing','Pelanggan yang ditugaskan dan tindak lanjut komersial.'),
 ('hrga','HRGA','Identitas personel dan kompetensi resmi.'),
 ('coordinator','Koordinator Operasional','Pemantauan portofolio yang disetujui; tanpa perubahan sertifikat HRGA.'),
 ('qshe','QSHE','Pemantauan kepatuhan pada portofolio yang ditugaskan.'),
 ('equipment_manager','PJ Peralatan','Peralatan dan kalibrasi pada portofolio yang ditugaskan.'),
 ('inspector','Personil / Inspector','Visibilitas kompetensi sendiri.'),
 ('branch_head','Kepala Cabang','Baca informasi bisnis cabang; tanpa hak tulis.')
 on conflict(code) do nothing;
update public.roles set description='Administrasi pada cabang yang diberikan secara eksplisit.' where code='admin';

create table public.work_areas (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 2 and 120),
 branch_code text not null default 'DPS' references public.branches(code), is_active boolean not null default true,
 unique(branch_code,name), unique(id,branch_code)
);
create table public.portfolios (
 id uuid primary key default gen_random_uuid(), code text not null check(length(trim(code)) between 1 and 32),
 name text not null check(length(trim(name)) between 2 and 160),
 branch_code text not null default 'DPS' references public.branches(code), is_active boolean not null default true,
 unique(branch_code,code), unique(id,branch_code)
);
create table public.portfolio_aliases (
 id uuid primary key default gen_random_uuid(), alias text not null,
 portfolio_id uuid not null, branch_code text not null default 'DPS' references public.branches(code),
 verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected')),
 verification_note text, verified_at timestamptz, verified_by uuid references public.profiles(id),
 is_active boolean not null default true, unique(branch_code,alias),
 foreign key(portfolio_id,branch_code) references public.portfolios(id,branch_code)
);
create table public.employee_directory (
 id uuid primary key default gen_random_uuid(), npp text check(npp is null or length(trim(npp)) between 1 and 40),
 full_name text not null check(length(trim(full_name)) between 2 and 160), position text,
 branch_code text not null default 'DPS' references public.branches(code),
 employment_status text not null default 'unknown' check(employment_status in ('active','inactive','unknown')),
 verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected')),
 verification_note text, verified_at timestamptz, verified_by uuid references public.profiles(id),
 is_active boolean not null default false, unique(branch_code,npp), unique(id,branch_code)
);
alter table public.profiles add column employee_id uuid unique, add column full_name text, add column email text,
 add column whatsapp text, add column updated_at timestamptz not null default now(),
 add constraint profiles_employee_branch_fk foreign key(employee_id,branch_code) references public.employee_directory(id,branch_code);
-- Do not change existing activation state or grant permissions based on editable user metadata.
update public.profiles set full_name=display_name where full_name is null;
create table public.user_role_assignments (
 id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id),
 role_code text not null references public.roles(code), branch_code text not null default 'DPS' references public.branches(code),
 is_active boolean not null default true, granted_by uuid references public.profiles(id), granted_at timestamptz not null default now(),
 revoked_by uuid references public.profiles(id), revoked_at timestamptz,
 grant_reason text not null check(length(trim(grant_reason)) between 8 and 1000),
 unique(profile_id,role_code,branch_code), check((is_active and revoked_at is null) or (not is_active and revoked_at is not null))
);
-- Preserve explicitly granted legacy admin scopes, without granting member accounts new authority.
insert into public.user_role_assignments(profile_id,role_code,branch_code,grant_reason)
 select id,'admin',branch_code,'Migrasi penugasan administrator tahap 01.' from public.profiles where role_code='admin'
 on conflict do nothing;
create table public.employee_portfolio_assignments (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null, portfolio_id uuid not null,
 branch_code text not null default 'DPS' references public.branches(code),
 assignment_type text not null check(assignment_type in ('coordinator','personnel','qshe','equipment_responsible')),
 effective_from date not null default (now() at time zone 'Asia/Makassar')::date, effective_until date,
 verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected')),
 verification_note text, approved_at timestamptz, approved_by uuid references public.profiles(id), is_active boolean not null default true,
 check(effective_until is null or effective_until>=effective_from),
 check(verification_status<>'verified' or approved_at is not null),
 unique(employee_id,portfolio_id,assignment_type,effective_from),
 foreign key(employee_id,branch_code) references public.employee_directory(id,branch_code),
 foreign key(portfolio_id,branch_code) references public.portfolios(id,branch_code)
);
create table public.certificate_types (
 id uuid primary key default gen_random_uuid(), code text not null, name text not null,
 category text not null check(category in ('client','personnel','equipment')),
 regulation_reference text, issuer text, default_validity_months integer check(default_validity_months between 1 and 600),
 reminder_days integer[] not null default array[90,60,30,0],
 branch_code text not null default 'DPS' references public.branches(code), is_active boolean not null default true,
 check(cardinality(reminder_days) between 1 and 16 and 0<=all(reminder_days) and 3650>=all(reminder_days) and array_position(reminder_days,null) is null),
 unique(branch_code,code), unique(id,branch_code)
);
create table public.service_types (
 id uuid primary key default gen_random_uuid(), code text not null, name text not null,
 branch_code text not null default 'DPS' references public.branches(code), is_active boolean not null default true,
 unique(branch_code,code), unique(id,branch_code)
);
create table public.service_competency_requirements (
 id uuid primary key default gen_random_uuid(), service_type_id uuid not null, certificate_type_id uuid not null,
 branch_code text not null default 'DPS' references public.branches(code), requirement_note text not null,
 verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected')),
 verification_note text, verified_at timestamptz, verified_by uuid references public.profiles(id), is_active boolean not null default true,
 unique(service_type_id,certificate_type_id),
 foreign key(service_type_id,branch_code) references public.service_types(id,branch_code),
 foreign key(certificate_type_id,branch_code) references public.certificate_types(id,branch_code)
);
create table public.clients (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 2 and 200),
 industry_sector text, address text, site_location text, work_area_id uuid, portfolio_id uuid,
 account_manager_id uuid references public.profiles(id), assignment_reason text,
 verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected')),
 verification_note text, verified_at timestamptz, verified_by uuid references public.profiles(id),
 branch_code text not null default 'DPS' references public.branches(code), is_active boolean not null default true,
 unique(id,branch_code),
 foreign key(work_area_id,branch_code) references public.work_areas(id,branch_code),
 foreign key(portfolio_id,branch_code) references public.portfolios(id,branch_code)
);
create table public.client_contacts (
 id uuid primary key default gen_random_uuid(), client_id uuid not null, name text not null check(length(trim(name)) between 2 and 160),
 position text, department text, email text, phone text, whatsapp text, is_primary boolean not null default false,
 verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected')),
 verification_note text, verified_at timestamptz, verified_by uuid references public.profiles(id),
 branch_code text not null default 'DPS' references public.branches(code), is_active boolean not null default true,
 foreign key(client_id,branch_code) references public.clients(id,branch_code)
);
create unique index one_active_primary_contact on public.client_contacts(client_id) where is_primary and is_active;
create table public.client_assignment_history (
 id uuid primary key default gen_random_uuid(), client_id uuid not null, old_account_manager_id uuid references public.profiles(id),
 new_account_manager_id uuid references public.profiles(id), changed_by uuid references public.profiles(id),
 changed_at timestamptz not null default now(), reason text not null, branch_code text not null references public.branches(code),
 foreign key(client_id,branch_code) references public.clients(id,branch_code)
);
create table public.client_certificates (
 id uuid primary key default gen_random_uuid(), client_id uuid not null, certificate_type_id uuid not null,
 order_reference text, contract_reference text, object_type text, object_serial text, capacity text, installation_location text,
 certificate_number text, inspection_date date, issue_date date, expiry_date date, inspector_employee_id uuid,
 previous_order_value numeric(20,2) check(previous_order_value>=0),
 renewal_status text not null default 'unreviewed' check(renewal_status in ('unreviewed','not_started','in_progress','renewed','closed')),
 verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected')),
 verification_note text, verified_at timestamptz, verified_by uuid references public.profiles(id), portfolio_id uuid,
 branch_code text not null default 'DPS' references public.branches(code),
 check(expiry_date is null or issue_date is null or expiry_date>=issue_date),
 foreign key(client_id,branch_code) references public.clients(id,branch_code),
 foreign key(certificate_type_id,branch_code) references public.certificate_types(id,branch_code),
 foreign key(inspector_employee_id,branch_code) references public.employee_directory(id,branch_code),
 foreign key(portfolio_id,branch_code) references public.portfolios(id,branch_code)
);
create table public.personnel_certificates (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null, certificate_type_id uuid not null,
 certificate_number text, issuer text, issue_date date, expiry_date date,
 verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected')),
 verification_note text, verified_at timestamptz, verified_by uuid references public.profiles(id),
 branch_code text not null default 'DPS' references public.branches(code), unique(id,branch_code),
 check(expiry_date is null or issue_date is null or expiry_date>=issue_date),
 foreign key(employee_id,branch_code) references public.employee_directory(id,branch_code),
 foreign key(certificate_type_id,branch_code) references public.certificate_types(id,branch_code)
);
create table public.personnel_certificate_services (
 id uuid primary key default gen_random_uuid(), personnel_certificate_id uuid not null, service_type_id uuid not null,
 branch_code text not null default 'DPS' references public.branches(code), unique(personnel_certificate_id,service_type_id),
 foreign key(personnel_certificate_id,branch_code) references public.personnel_certificates(id,branch_code),
 foreign key(service_type_id,branch_code) references public.service_types(id,branch_code)
);
create table public.equipment (
 id uuid primary key default gen_random_uuid(), asset_id text, tag text, name text not null, brand text, model text,
 serial text, measurement_range text, location text, portfolio_id uuid, unit text,
 ownership text not null check(ownership in ('internal','client')), client_id uuid, responsible_employee_id uuid,
 branch_code text not null default 'DPS' references public.branches(code), is_active boolean not null default true,
 check((ownership='internal' and client_id is null) or (ownership='client' and client_id is not null)),
 unique(branch_code,asset_id), unique(id,branch_code),
 foreign key(client_id,branch_code) references public.clients(id,branch_code),
 foreign key(portfolio_id,branch_code) references public.portfolios(id,branch_code),
 foreign key(responsible_employee_id,branch_code) references public.employee_directory(id,branch_code)
);
create table public.calibrations (
 id uuid primary key default gen_random_uuid(), equipment_id uuid not null, laboratory text, certificate_number text,
 calibration_date date, issue_date date, due_date date, interval_months integer check(interval_months between 1 and 600),
 date_basis text check(date_basis in ('certificate','laboratory','approved_interval','unverified')), date_source text,
 result text check(result in ('layak','tidak_layak')),
 verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected')),
 verification_note text, verified_at timestamptz, verified_by uuid references public.profiles(id),
 branch_code text not null default 'DPS' references public.branches(code),
 check(due_date is null or calibration_date is null or due_date>=calibration_date),
 foreign key(equipment_id,branch_code) references public.equipment(id,branch_code)
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), table_name text not null, record_id text not null,
 action text not null check(action in ('INSERT','UPDATE','DELETE')), actor_id uuid references auth.users(id) on delete set null,
 occurred_at timestamptz not null default now(), old_values jsonb, new_values jsonb,
 branch_code text not null references public.branches(code), database_actor text not null
);

-- Consistent record metadata, independently of client-supplied values.
do $$ declare t text; begin
 foreach t in array array['work_areas','portfolios','portfolio_aliases','employee_directory','profiles','user_role_assignments',
 'employee_portfolio_assignments','certificate_types','service_types','service_competency_requirements','clients','client_contacts',
 'client_certificates','personnel_certificates','personnel_certificate_services','equipment','calibrations','branches'] loop
  execute format('alter table public.%I add column if not exists created_at timestamptz not null default now(), add column if not exists updated_at timestamptz not null default now(), add column created_by uuid references auth.users(id) on delete set null, add column updated_by uuid references auth.users(id) on delete set null',t);
 end loop;
end $$;

-- Helpers read only the authenticated actor's grants. SECURITY DEFINER is limited to these
-- private lookups to prevent profiles -> assignments -> profiles RLS recursion.
create function private.actor_enabled() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.profiles p
 join public.employee_directory e on e.id=p.employee_id and e.branch_code=p.branch_code
 where p.id=auth.uid() and p.is_active and e.is_active and e.verification_status='verified' and e.employment_status='active');
$$;
create function private.has_role(b text, wanted text[]) returns boolean language sql stable security definer set search_path='' as $$
 select private.actor_enabled() and exists(select 1 from public.user_role_assignments a
 join public.roles r on r.code=a.role_code and r.is_active join public.branches br on br.code=a.branch_code and br.is_active
 where a.profile_id=auth.uid() and a.branch_code=b and a.is_active and a.revoked_at is null and a.role_code=any(wanted));
$$;
create function private.branch_access(b text) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_role(b,array['admin','account_manager','hrga','coordinator','qshe','equipment_manager','inspector','branch_head']);
$$;
create function private.portfolio_scope(b text, portfolio uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_role(b,array['admin','branch_head']) or (private.actor_enabled() and exists(
 select 1 from public.profiles p join public.employee_portfolio_assignments a on a.employee_id=p.employee_id
 join public.portfolios po on po.id=a.portfolio_id and po.branch_code=a.branch_code and po.is_active
 where p.id=auth.uid() and a.branch_code=b and a.portfolio_id=portfolio and a.is_active and a.verification_status='verified'
 and a.approved_at is not null and a.effective_from<=(now() at time zone 'Asia/Makassar')::date
 and (a.effective_until is null or a.effective_until>=(now() at time zone 'Asia/Makassar')::date)
 and ((a.assignment_type='coordinator' and private.has_role(b,array['coordinator']))
 or (a.assignment_type='qshe' and private.has_role(b,array['qshe']))
 or (a.assignment_type='equipment_responsible' and private.has_role(b,array['equipment_manager'])))));
$$;
create function private.employee_scope(b text, employee uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_role(b,array['admin','hrga','branch_head'])
 or (private.has_role(b,array['inspector']) and exists(select 1 from public.profiles p where p.id=auth.uid() and p.employee_id=employee))
 or (private.has_role(b,array['coordinator','qshe']) and exists(select 1 from public.employee_portfolio_assignments a
 where a.employee_id=employee and a.branch_code=b and a.is_active and a.verification_status='verified'
 and a.effective_from<=(now() at time zone 'Asia/Makassar')::date and (a.effective_until is null or a.effective_until>=(now() at time zone 'Asia/Makassar')::date)
 and private.portfolio_scope(b,a.portfolio_id)));
$$;
-- Internal validation helpers are not executable by app roles.
create function private.target_has_role(u uuid,b text,r text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.employee_directory e on e.id=p.employee_id and e.is_active and e.verification_status='verified' and e.employment_status='active'
 join public.user_role_assignments a on a.profile_id=p.id and a.is_active and a.revoked_at is null
 join public.roles ro on ro.code=a.role_code and ro.is_active
 where p.id=u and p.is_active and a.branch_code=b and a.role_code=r);
$$;
create function private.client_scope(b text,c uuid,writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_role(b,array['admin']) or exists(select 1 from public.clients x where x.id=c and x.branch_code=b and (
 (private.has_role(b,array['account_manager']) and x.account_manager_id=auth.uid())
 or (not writing and (private.has_role(b,array['branch_head']) or (private.has_role(b,array['qshe']) and private.portfolio_scope(b,x.portfolio_id))))));
$$;
create function private.equipment_scope(b text,e uuid,writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_role(b,array['admin']) or exists(select 1 from public.equipment x where x.id=e and x.branch_code=b and (
 (private.has_role(b,array['equipment_manager']) and private.portfolio_scope(b,x.portfolio_id))
 or (not writing and (private.has_role(b,array['branch_head']) or (private.has_role(b,array['coordinator','qshe']) and private.portfolio_scope(b,x.portfolio_id))))));
$$;
revoke all on all functions in schema private from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.actor_enabled(),private.has_role(text,text[]),private.branch_access(text),private.portfolio_scope(text,uuid),private.employee_scope(text,uuid),private.client_scope(text,uuid,boolean),private.equipment_scope(text,uuid,boolean) to authenticated;

create function private.guard_record() returns trigger language plpgsql security definer set search_path='' as $$
declare j jsonb:=to_jsonb(new); oldj jsonb; actor uuid:=auth.uid(); old_branch text; expected_category text; target_client uuid;
begin
 if tg_op='UPDATE' then
  oldj:=to_jsonb(old); old_branch:=coalesce(oldj->>'branch_code',oldj->>'code');
  if j->>'id' is distinct from oldj->>'id' or coalesce(j->>'branch_code',j->>'code') is distinct from old_branch then
   raise exception 'Identitas dan cabang rekaman tidak dapat diubah.' using errcode='42501';
  end if;
  new.created_at:=old.created_at; new.created_by:=old.created_by;
 else new.created_at:=now(); new.created_by:=actor; end if;
 new.updated_at:=now(); new.updated_by:=actor;
 if tg_table_name='profiles' then
  if tg_op='UPDATE' and new.role_code is distinct from old.role_code then raise exception 'role_code lama tidak dapat dipakai untuk memberi kewenangan.' using errcode='42501'; end if;
  if new.is_active then
   if not exists(select 1 from public.employee_directory e where e.id=new.employee_id and e.branch_code=new.branch_code and e.is_active and e.verification_status='verified' and e.employment_status='active') then
    raise exception 'Aktivasi memerlukan pegawai aktif yang telah diverifikasi.' using errcode='23514';
   end if;
   if tg_op='INSERT' or not old.is_active then new.activated_at:=now(); new.activated_by:=actor; end if;
  end if;
 end if;
 if tg_table_name='user_role_assignments' then
  if actor is not null and new.profile_id=actor then raise exception 'Penugasan peran sendiri tidak diizinkan.' using errcode='42501'; end if;
  if tg_op='UPDATE' and (new.profile_id<>old.profile_id or new.role_code<>old.role_code) then raise exception 'Identitas penugasan tidak dapat diubah.' using errcode='42501'; end if;
  if not exists(select 1 from public.roles where code=new.role_code and is_active) then raise exception 'Peran tidak aktif.' using errcode='23514'; end if;
  if tg_op='INSERT' or (new.is_active and not old.is_active) then new.granted_at:=now(); new.granted_by:=actor; end if;
  if new.is_active then new.revoked_at:=null; new.revoked_by:=null; else new.revoked_at:=now(); new.revoked_by:=actor; end if;
 end if;
 if j ? 'verification_status' then
  if tg_op='INSERT' or j->>'verification_status' is distinct from oldj->>'verification_status' then
   if tg_table_name='employee_portfolio_assignments' then
    if new.verification_status='verified' then new.approved_at:=now(); new.approved_by:=actor; else new.approved_at:=null; new.approved_by:=null; end if;
   else
    if new.verification_status='verified' then new.verified_at:=now(); new.verified_by:=actor; else new.verified_at:=null; new.verified_by:=null; end if;
   end if;
  elsif tg_table_name='employee_portfolio_assignments' then new.approved_at:=old.approved_at; new.approved_by:=old.approved_by;
  else new.verified_at:=old.verified_at; new.verified_by:=old.verified_by; end if;
 end if;
 if tg_table_name='clients' then
  if tg_op='UPDATE' and new.account_manager_id is distinct from old.account_manager_id then
   if actor is not null and not private.has_role(new.branch_code,array['admin']) then raise exception 'Pengalihan AM memerlukan administrator cabang.' using errcode='42501'; end if;
   if length(trim(coalesce(new.assignment_reason,'')))<8 then raise exception 'Alasan pengalihan AM minimal 8 karakter.' using errcode='23514'; end if;
  end if;
  if new.account_manager_id is not null and not private.target_has_role(new.account_manager_id,new.branch_code,'account_manager') then raise exception 'AM harus memiliki penugasan aktif pada cabang pelanggan.' using errcode='23514'; end if;
 end if;
 if tg_table_name in ('client_certificates','personnel_certificates','service_competency_requirements') then
  expected_category:=case when tg_table_name='client_certificates' then 'client' else 'personnel' end;
  if not exists(select 1 from public.certificate_types c where c.id=new.certificate_type_id and c.branch_code=new.branch_code and c.category=expected_category) then raise exception 'Kategori jenis sertifikat tidak sesuai.' using errcode='23514'; end if;
 end if;
 if tg_op='UPDATE' and actor is not null and tg_table_name in ('client_contacts','client_certificates','personnel_certificates','calibrations','employee_portfolio_assignments','portfolio_aliases','service_competency_requirements','personnel_certificate_services') then
  if (j->>'client_id' is distinct from oldj->>'client_id') or (j->>'employee_id' is distinct from oldj->>'employee_id') or (j->>'equipment_id' is distinct from oldj->>'equipment_id') or (j->>'personnel_certificate_id' is distinct from oldj->>'personnel_certificate_id') or (j->>'portfolio_id' is distinct from oldj->>'portfolio_id') or (j->>'service_type_id' is distinct from oldj->>'service_type_id') then
   raise exception 'Relasi induk tidak dapat dipindahkan melalui perubahan rekaman.' using errcode='42501';
  end if;
 end if;
 if tg_table_name='equipment' then
  if tg_op='UPDATE' and actor is not null and not private.has_role(new.branch_code,array['admin']) then
   if new.portfolio_id is distinct from old.portfolio_id or new.client_id is distinct from old.client_id or new.responsible_employee_id is distinct from old.responsible_employee_id then raise exception 'Pengalihan kepemilikan aset memerlukan administrator.' using errcode='42501'; end if;
  end if;
 end if;
 return new;
end $$;
create function private.audit_business_record() returns trigger language plpgsql security definer set search_path='' as $$
declare j jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
 insert into public.audit_logs(table_name,record_id,action,actor_id,old_values,new_values,branch_code,database_actor)
 values(tg_table_name,coalesce(j->>'id',j->>'code'),tg_op,auth.uid(),case when tg_op<>'INSERT' then to_jsonb(old) end,
 case when tg_op<>'DELETE' then to_jsonb(new) end,coalesce(j->>'branch_code',j->>'code'),session_user);
 if tg_table_name='clients' then
  if tg_op='INSERT' or new.account_manager_id is distinct from old.account_manager_id then
   insert into public.client_assignment_history(client_id,old_account_manager_id,new_account_manager_id,changed_by,reason,branch_code)
   values(new.id,case when tg_op='UPDATE' then old.account_manager_id end,new.account_manager_id,auth.uid(),coalesce(nullif(trim(new.assignment_reason),''),'Penetapan awal pelanggan.'),new.branch_code);
  end if;
 end if;
 return coalesce(new,old);
end $$;
revoke all on function private.guard_record(),private.audit_business_record() from public,anon,authenticated;

-- Replace only phase-01 policies, preserving rows and the original private audit ledger.
drop policy profiles_read_active_self on public.profiles;
drop policy branches_read_own on public.branches;
drop policy roles_read_assigned on public.roles;
do $$ declare t text; begin
 foreach t in array array['branches','profiles','work_areas','portfolios','portfolio_aliases','employee_directory','user_role_assignments',
 'employee_portfolio_assignments','certificate_types','service_types','service_competency_requirements','clients','client_contacts',
 'client_certificates','personnel_certificates','personnel_certificate_services','equipment','calibrations'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create trigger guard_record before insert or update on public.%I for each row execute function private.guard_record()',t);
  execute format('create trigger audit_business_record after insert or update or delete on public.%I for each row execute function private.audit_business_record()',t);
 end loop;
 foreach t in array array['audit_logs','client_assignment_history'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create policy branches_read on public.branches for select to authenticated using(private.branch_access(code));
create policy branches_edit on public.branches for update to authenticated using(private.has_role(code,array['admin'])) with check(private.has_role(code,array['admin']));
-- New branches require organizational provisioning, never an implicit global Admin privilege.
create policy roles_read on public.roles for select to authenticated using(private.actor_enabled());
create policy profiles_read on public.profiles for select to authenticated using(private.actor_enabled() and (id=auth.uid() or private.has_role(branch_code,array['admin'])));
create policy profiles_insert on public.profiles for insert to authenticated with check(id<>auth.uid() and private.has_role(branch_code,array['admin']));
create policy profiles_edit on public.profiles for update to authenticated using(id<>auth.uid() and private.has_role(branch_code,array['admin'])) with check(id<>auth.uid() and private.has_role(branch_code,array['admin']));
create policy grants_read on public.user_role_assignments for select to authenticated using(private.actor_enabled() and (profile_id=auth.uid() or private.has_role(branch_code,array['admin'])));
create policy grants_insert on public.user_role_assignments for insert to authenticated with check(profile_id<>auth.uid() and private.has_role(branch_code,array['admin']));
create policy grants_edit on public.user_role_assignments for update to authenticated using(profile_id<>auth.uid() and private.has_role(branch_code,array['admin'])) with check(profile_id<>auth.uid() and private.has_role(branch_code,array['admin']));
do $$ declare t text; begin
 foreach t in array array['work_areas','portfolios','portfolio_aliases','certificate_types','service_types','service_competency_requirements'] loop
  execute format('create policy catalog_read on public.%I for select to authenticated using(private.branch_access(branch_code))',t);
  execute format('create policy catalog_insert on public.%I for insert to authenticated with check(private.has_role(branch_code,array[''admin'']))',t);
  execute format('create policy catalog_edit on public.%I for update to authenticated using(private.has_role(branch_code,array[''admin''])) with check(private.has_role(branch_code,array[''admin'']))',t);
 end loop;
end $$;
create policy employees_read on public.employee_directory for select to authenticated using(private.employee_scope(branch_code,id));
create policy employees_insert on public.employee_directory for insert to authenticated with check(private.has_role(branch_code,array['admin','hrga']));
create policy employees_edit on public.employee_directory for update to authenticated using(private.has_role(branch_code,array['admin','hrga'])) with check(private.has_role(branch_code,array['admin','hrga']));
create policy portfolios_assign_read on public.employee_portfolio_assignments for select to authenticated using(private.employee_scope(branch_code,employee_id));
create policy portfolios_assign_insert on public.employee_portfolio_assignments for insert to authenticated with check(private.has_role(branch_code,array['admin','hrga']));
create policy portfolios_assign_edit on public.employee_portfolio_assignments for update to authenticated using(private.has_role(branch_code,array['admin','hrga'])) with check(private.has_role(branch_code,array['admin','hrga']));
create policy clients_read on public.clients for select to authenticated using(private.client_scope(branch_code,id));
create policy clients_insert on public.clients for insert to authenticated with check(private.has_role(branch_code,array['admin']) or (private.has_role(branch_code,array['account_manager']) and account_manager_id=auth.uid()));
create policy clients_edit on public.clients for update to authenticated using(private.client_scope(branch_code,id,true)) with check(private.client_scope(branch_code,id,true));
do $$ declare t text; begin
 foreach t in array array['client_contacts','client_certificates'] loop
  execute format('create policy client_records_read on public.%I for select to authenticated using(private.client_scope(branch_code,client_id))',t);
  execute format('create policy client_records_insert on public.%I for insert to authenticated with check(private.client_scope(branch_code,client_id,true))',t);
  execute format('create policy client_records_edit on public.%I for update to authenticated using(private.client_scope(branch_code,client_id,true)) with check(private.client_scope(branch_code,client_id,true))',t);
 end loop;
end $$;
create policy personnel_read on public.personnel_certificates for select to authenticated using(private.employee_scope(branch_code,employee_id));
create policy personnel_insert on public.personnel_certificates for insert to authenticated with check(private.has_role(branch_code,array['admin','hrga']));
create policy personnel_edit on public.personnel_certificates for update to authenticated using(private.has_role(branch_code,array['admin','hrga'])) with check(private.has_role(branch_code,array['admin','hrga']));
create policy personnel_services_read on public.personnel_certificate_services for select to authenticated using(exists(select 1 from public.personnel_certificates c where c.id=personnel_certificate_id and c.branch_code=personnel_certificate_services.branch_code));
create policy personnel_services_insert on public.personnel_certificate_services for insert to authenticated with check(private.has_role(branch_code,array['admin','hrga']));
create policy personnel_services_edit on public.personnel_certificate_services for update to authenticated using(private.has_role(branch_code,array['admin','hrga'])) with check(private.has_role(branch_code,array['admin','hrga']));
create policy equipment_read on public.equipment for select to authenticated using(private.equipment_scope(branch_code,id));
create policy equipment_insert on public.equipment for insert to authenticated with check(private.has_role(branch_code,array['admin']) or (private.has_role(branch_code,array['equipment_manager']) and private.portfolio_scope(branch_code,portfolio_id)));
create policy equipment_edit on public.equipment for update to authenticated using(private.equipment_scope(branch_code,id,true)) with check(private.equipment_scope(branch_code,id,true));
create policy calibrations_read on public.calibrations for select to authenticated using(private.equipment_scope(branch_code,equipment_id));
create policy calibrations_insert on public.calibrations for insert to authenticated with check(private.equipment_scope(branch_code,equipment_id,true));
create policy calibrations_edit on public.calibrations for update to authenticated using(private.equipment_scope(branch_code,equipment_id,true)) with check(private.equipment_scope(branch_code,equipment_id,true));
create policy assignment_history_read on public.client_assignment_history for select to authenticated using(private.client_scope(branch_code,client_id));
create policy audit_read on public.audit_logs for select to authenticated using(private.has_role(branch_code,array['admin']));

-- Explicit FK indexes, avoiding duplicate prefixes already covered by a primary/unique index.
do $$ declare c record; cols text; begin
 for c in select conname,conrelid,conkey from pg_constraint where contype='f' and connamespace='public'::regnamespace loop
  if not exists(select 1 from pg_index i where i.indrelid=c.conrelid and i.indisvalid
   and (select array_agg(k.att order by k.ord) from unnest(i.indkey) with ordinality k(att,ord) where k.ord<=cardinality(c.conkey))=c.conkey) then
   select string_agg(quote_ident(a.attname),',' order by k.ord) into cols from unnest(c.conkey) with ordinality k(att,ord) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.att;
   execute format('create index %I on %s (%s)',left(c.conname,52)||'_idx',c.conrelid::regclass,cols);
  end if;
 end loop;
end $$;
create index client_certificates_expiry_idx on public.client_certificates(branch_code,expiry_date);
create index personnel_certificates_expiry_idx on public.personnel_certificates(branch_code,expiry_date);
create index calibrations_due_idx on public.calibrations(branch_code,due_date);
create index audit_branch_time_idx on public.audit_logs(branch_code,occurred_at desc);
create index role_actor_scope_idx on public.user_role_assignments(profile_id,branch_code,role_code) where is_active and revoked_at is null;
create index employee_portfolio_scope_idx on public.employee_portfolio_assignments(employee_id,branch_code,portfolio_id) where is_active and verification_status='verified';

insert into public.work_areas(name,branch_code) values ('Bali','DPS'),('NTB','DPS'),('NTT','DPS');
insert into public.portfolios(code,name,branch_code)
 select v,v,'DPS' from unnest(array['HMPM','AEBT','PIK','MIN','BBR','KSP','LSI','SERCO','IND','LAB','UP Benete','UP Lombok']) v;
insert into public.certificate_types(code,name,category,branch_code) values
 ('CONTOH_KLIEN','Contoh jenis sertifikat klien','client','DPS'),
 ('CONTOH_PERSONEL','Contoh jenis sertifikat kompetensi','personnel','DPS'),
 ('CONTOH_ALAT','Contoh jenis sertifikat kalibrasi','equipment','DPS');
comment on column public.profiles.role_code is 'Legacy tahap 01; otorisasi hanya user_role_assignments. Tidak boleh dipakai untuk hak akses.';
comment on table public.personnel_certificates is 'Riwayat kompetensi milik identitas employee_directory, independen dari keberadaan akun login.';
comment on table public.client_certificates is 'Sertifikat tetap milik client_id; pengalihan AM tidak menulis ulang sertifikat.';
