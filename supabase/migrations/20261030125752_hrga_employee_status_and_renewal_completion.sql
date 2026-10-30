-- Employment state is separate from legacy directory activation/verification.
-- No existing employee state or certificate is changed by this migration.
alter table public.employee_directory
 add column employment_status_reason text check (employment_status_reason in ('resigned','transferred','other','reactivated')),
 add column employment_status_note text,
 add column employment_status_effective_on date,
 add column employment_status_version integer not null default 0;

create table public.employee_status_events (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null,
 branch_code text not null references public.branches(code),
 previous_status text not null,
 new_status text not null check(new_status in ('active','inactive')),
 reason text not null,
 notes text not null,
 effective_on date not null,
 actor_id uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 foreign key(employee_id,branch_code) references public.employee_directory(id,branch_code)
);
create index employee_status_events_parent on public.employee_status_events(employee_id,branch_code,created_at desc);
create index employee_status_events_actor on public.employee_status_events(actor_id);
alter table public.employee_status_events enable row level security;
grant select on public.employee_status_events to authenticated;
create policy employee_status_events_read on public.employee_status_events for select to authenticated
 using(private.has_role(branch_code,array['admin','hrga']));

create function private.guard_employee_employment_status() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  new.employment_status_version:=0;
  -- Initial master import can remain unknown/active without a lifecycle event.
  if new.employment_status<>'inactive' and new.employment_status_reason is null and new.employment_status_note is null and new.employment_status_effective_on is null then return new;end if;
 elsif row(new.employment_status,new.employment_status_reason,new.employment_status_note,new.employment_status_effective_on)
  is not distinct from row(old.employment_status,old.employment_status_reason,old.employment_status_note,old.employment_status_effective_on) then
  new.employment_status_version:=old.employment_status_version;return new;
 end if;
 if auth.uid() is null or not private.has_role(new.branch_code,array['admin','hrga']) then raise exception 'Status personil hanya dapat diubah HRGA/administrator.' using errcode='42501';end if;
 if exists(select 1 from public.profiles p where p.id=auth.uid() and p.employee_id=new.id) then raise exception 'Perubahan status personil sendiri memerlukan administrator lain.' using errcode='42501';end if;
 if new.merged_into_employee_id is not null then raise exception 'Gunakan identitas pegawai utama.';end if;
 if new.employment_status not in ('active','inactive') then raise exception 'Pilih Aktif atau Nonaktif.';end if;
 if new.employment_status_reason is null or (new.employment_status='active' and new.employment_status_reason<>'reactivated') or (new.employment_status='inactive' and new.employment_status_reason not in ('resigned','transferred','other')) then raise exception 'Pilih alasan sesuai status personil.';end if;
 if length(trim(coalesce(new.employment_status_note,''))) not between 8 and 2000 then raise exception 'Keterangan status wajib diisi, 8–2000 karakter.';end if;
 if new.employment_status_effective_on is null or new.employment_status_effective_on>(now() at time zone 'Asia/Makassar')::date then raise exception 'Tanggal efektif wajib diisi dan tidak boleh melewati hari ini (WITA).';end if;
 if tg_op='UPDATE' and new.employment_status_effective_on<old.employment_status_effective_on then raise exception 'Tanggal efektif tidak boleh mendahului perubahan status terakhir.';end if;
 new.employment_status_version:=case when tg_op='INSERT' then 1 else old.employment_status_version+1 end;
 return new;
end $$;
create function private.record_employee_status_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (tg_op='INSERT' and new.employment_status_version>0) or (tg_op='UPDATE' and new.employment_status_version<>old.employment_status_version) then
  insert into public.employee_status_events(employee_id,branch_code,previous_status,new_status,reason,notes,effective_on,actor_id)
  values(new.id,new.branch_code,case when tg_op='INSERT' then 'unknown' else old.employment_status end,new.employment_status,new.employment_status_reason,trim(new.employment_status_note),new.employment_status_effective_on,auth.uid());
 end if;
 return new;
end $$;
revoke all on function private.guard_employee_employment_status(),private.record_employee_status_event() from public,anon,authenticated;
create trigger employment_status_guard before insert or update on public.employee_directory for each row execute function private.guard_employee_employment_status();
create trigger employment_status_event after insert or update on public.employee_directory for each row execute function private.record_employee_status_event();
create or replace view public.employee_directory_records with(security_invoker=true) as select e.* from public.employee_directory e where merged_into_employee_id is null;

-- An explicit HRGA inactive decision blocks access, including existing JWTs.
-- Legacy is_active=false and verification=pending are still NOT login gates.
create or replace function private.actor_enabled() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.retired_at is null
 and not exists(select 1 from public.employee_directory e where e.id=p.employee_id and e.branch_code=p.branch_code and e.employment_status='inactive'));
$$;
create or replace function private.target_has_role(u uuid,b text,r text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.user_role_assignments a on a.profile_id=p.id and a.is_active and a.revoked_at is null join public.roles ro on ro.code=a.role_code and ro.is_active join public.branches br on br.code=a.branch_code and br.is_active
 where p.id=u and p.is_active and p.retired_at is null and a.branch_code=b and a.role_code=r
 and not exists(select 1 from public.employee_directory e where e.id=p.employee_id and e.branch_code=p.branch_code and e.employment_status='inactive'));
$$;

create function private.guard_active_personnel_renewal() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or new.status is distinct from old.status then
  if exists(select 1 from public.personnel_certificates c join public.employee_directory e on e.id=c.employee_id and e.branch_code=c.branch_code where c.id=new.certificate_id and c.branch_code=new.branch_code and e.employment_status='inactive') then raise exception 'Personil nonaktif tidak dapat melanjutkan perpanjangan. Riwayat tetap tersedia.';end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_active_personnel_renewal() from public,anon,authenticated;
create trigger active_personnel_renewal_guard before insert or update on public.personnel_renewal_cases for each row execute function private.guard_active_personnel_renewal();

-- One transaction: record a new certificate generation, then close the HRGA case.
-- Invoker security preserves table RLS and existing renewal gates/notifications.
create function public.complete_personnel_renewal(case_id uuid,expected_version integer,new_certificate jsonb,process_note text)
 returns uuid language plpgsql security invoker set search_path='' as $$
declare w public.personnel_renewal_cases;c public.personnel_certificates;replacement uuid;issued date;expires date;months integer;folder text;
begin
 select * into w from public.personnel_renewal_cases where id=case_id for update;
 if w.id is null or not private.has_role(w.branch_code,array['admin','hrga']) then raise exception 'Proses tidak ditemukan atau akses ditolak.' using errcode='42501';end if;
 if w.version<>expected_version or w.status<>'processing' then raise exception 'Proses telah berubah. Muat ulang sebelum menyelesaikan.';end if;
 select * into c from public.personnel_certificates where id=w.certificate_id and branch_code=w.branch_code;
 if not c.is_active then raise exception 'Sertifikat sumber tidak aktif.';end if;
 if exists(select 1 from public.employee_directory e where e.id=c.employee_id and e.employment_status='inactive') then raise exception 'Personil nonaktif tidak dapat membuka perpanjangan baru.';end if;
 issued:=(new_certificate->>'issue_date')::date;expires:=(new_certificate->>'expiry_date')::date;months:=nullif(new_certificate->>'interval_months','')::integer;folder:=trim(new_certificate->>'source_folder_url');
 if issued is null or expires is null or issued>expires or issued> (now() at time zone 'Asia/Makassar')::date or issued<coalesce(c.issue_date,'0001-01-01'::date) or expires<=coalesce(c.expiry_date,'0001-01-01'::date) then raise exception 'Isi tanggal terbit terbaru dan masa berlaku yang lebih baru sesuai dokumen.';end if;
 if length(trim(coalesce(new_certificate->>'certificate_number','')))=0 or folder is null or folder!~'^https://drive[.]google[.]com/drive/(u/[0-9]+/)?folders/[A-Za-z0-9_-]+' then raise exception 'Nomor sertifikat dan folder bukti Google Drive wajib diisi.';end if;
 insert into public.personnel_certificates(branch_code,employee_id,certificate_type_id,original_title,original_holder_name,issuer,certificate_number,validity_kind,issue_date,interval_months,expiry_date,source_folder_url,source_provider,is_active)
 values(c.branch_code,c.employee_id,c.certificate_type_id,c.original_title,c.original_holder_name,coalesce(nullif(trim(new_certificate->>'issuer'),''),c.issuer),trim(new_certificate->>'certificate_number'),'term',issued,months,expires,folder,'google_drive_folder',true) returning id into replacement;
 update public.personnel_renewal_cases set status='renewed',replacement_certificate_id=replacement,notes=process_note where id=w.id and version=expected_version;
 if not found then raise exception 'Proses telah berubah.';end if;
 return replacement;
end $$;
revoke all on function public.complete_personnel_renewal(uuid,integer,jsonb,text) from public,anon;
grant execute on function public.complete_personnel_renewal(uuid,integer,jsonb,text) to authenticated;
