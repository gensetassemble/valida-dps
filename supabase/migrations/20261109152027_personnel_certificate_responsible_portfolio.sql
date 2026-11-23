-- Explicit responsibility belongs to a certificate, not the employee's aggregate placement.
-- Existing records stay unmapped until HRGA/Admin checks the license; no workforce reimport.
alter table public.personnel_certificates add column portfolio_id uuid;
alter table public.personnel_certificates add constraint personnel_certificate_portfolio_branch_fk
 foreign key (portfolio_id,branch_code) references public.portfolios(id,branch_code);
create index personnel_certificate_portfolio_branch on public.personnel_certificates(branch_code,portfolio_id);
comment on column public.personnel_certificates.portfolio_id is 'Responsible portfolio for this license; distinct from employee placement.';
create or replace view public.personnel_certificate_portfolios with(security_invoker=true) as
select base.*,
 case validity_status when 'Expired' then 0 when 'Kritis' then 1 when 'Perhatian' then 2 when 'Pantau' then 3 when 'Aman' then 4 when 'Tanggal Belum Diisi' then 5 else 6 end as validity_priority,
 (select string_agg(p.code,' / ' order by p.code) from public.portfolios p where p.branch_code=base.branch_code and p.id=any(base.portfolio_ids)) as portfolio_sort_key,
 (select p.portfolio_id from public.personnel_certificates p where p.id=base.id and p.branch_code=base.branch_code) as portfolio_id
from (select c.*,array(select p.portfolio_id from public.personnel_certificates p where p.id=c.id and p.branch_code=c.branch_code and p.portfolio_id is not null) as portfolio_ids,
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
where prior.id is null or prior.history_deleted_at is null) base;

create or replace function public.complete_personnel_renewal(case_id uuid,expected_version integer,new_certificate jsonb,process_note text)
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
 insert into public.personnel_certificates(branch_code,employee_id,certificate_type_id,original_title,original_holder_name,issuer,certificate_number,validity_kind,issue_date,interval_months,expiry_date,source_folder_url,source_provider,is_active,portfolio_id)
 values(c.branch_code,c.employee_id,c.certificate_type_id,c.original_title,c.original_holder_name,coalesce(nullif(trim(new_certificate->>'issuer'),''),c.issuer),trim(new_certificate->>'certificate_number'),'term',issued,months,expires,folder,'google_drive_folder',true,c.portfolio_id) returning id into replacement;
 update public.personnel_renewal_cases set status='renewed',replacement_certificate_id=replacement,notes=process_note where id=w.id and version=expected_version;
 if not found then raise exception 'Proses telah berubah.';end if;
 return replacement;
end $$;
revoke all on function public.complete_personnel_renewal(uuid,integer,jsonb,text) from public,anon;
grant execute on function public.complete_personnel_renewal(uuid,integer,jsonb,text) to authenticated;
