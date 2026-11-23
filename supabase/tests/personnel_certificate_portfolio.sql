begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
-- Synthetic HRGA fixture; rollback removes every fixture and notification.
insert into auth.users(id,email) values ('ac910000-0000-4000-8000-000000000001','portfolio.qa@example.invalid');
insert into public.employee_directory(id,branch_code,full_name,employment_status,verification_status,is_active)
 values ('ac910000-0000-4000-8000-000000000002','DPS','[UJI] Portfolio HRGA','active','verified',true);
insert into public.profiles(id,employee_id,branch_code,full_name,is_active)
 values ('ac910000-0000-4000-8000-000000000001','ac910000-0000-4000-8000-000000000002','DPS','[UJI] Portfolio HRGA',true);
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason,is_active)
 values ('ac910000-0000-4000-8000-000000000001','DPS','hrga','Synthetic portfolio verification',true);
insert into public.portfolios(id,branch_code,code,name)
 values ('ac910000-0000-4000-8000-000000000003','DPS','UJI_PORTO','[UJI] Portfolio');
insert into public.certificate_types(id,branch_code,code,name,category)
 values ('ac910000-0000-4000-8000-000000000004','DPS','UJI_PORTO_LIC','[UJI] License','personnel');
insert into public.personnel_certificates(id,branch_code,employee_id,certificate_type_id,original_title,issue_date,expiry_date)
 values ('ac910000-0000-4000-8000-000000000005','DPS','ac910000-0000-4000-8000-000000000002','ac910000-0000-4000-8000-000000000004','[UJI] License','2025-01-01','2026-01-01');
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
select set_config('request.jwt.claim.sub','ac910000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare w uuid; replacement uuid; begin
 update public.personnel_certificates set portfolio_id='ac910000-0000-4000-8000-000000000003' where id='ac910000-0000-4000-8000-000000000005';
 if not found then raise exception 'HRGA cannot map existing certificate'; end if;
 if (select portfolio_ids from public.personnel_certificate_portfolios where id='ac910000-0000-4000-8000-000000000005') is distinct from array['ac910000-0000-4000-8000-000000000003'::uuid] then raise exception 'View does not expose certificate responsibility'; end if;
 insert into public.personnel_renewal_cases(branch_code,certificate_id,status,notes)
 values ('DPS','ac910000-0000-4000-8000-000000000005','unprocessed','Synthetic portfolio test') returning id into w;
 update public.personnel_renewal_cases set status='processing',notes='Synthetic processing test' where id=w;
 replacement:=public.complete_personnel_renewal(w,2,jsonb_build_object('certificate_number','UJI-REPLACEMENT','issue_date',current_date::text,'expiry_date',(current_date+365)::text,'source_folder_url','https://drive.google.com/drive/folders/synthetic-portfolio-qa'),'Synthetic completed test');
 if (select portfolio_id from public.personnel_certificates where id=replacement) is distinct from 'ac910000-0000-4000-8000-000000000003'::uuid then raise exception 'Renewal lost responsible portfolio'; end if;
end $$;
reset role;
select pass('HRGA maps certificate responsibility and renewal preserves its portfolio');
select * from finish();
rollback;
