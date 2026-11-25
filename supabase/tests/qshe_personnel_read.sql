-- Synthetic fixtures; the whole test rolls back.
begin;
create function pg_temp.assert_qshe(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'QSHE access: %',label;end if;end $$;
insert into public.branches(code,name) values ('QSHQA','[UJI] QSHE branch'),('QSHQB','[UJI] Outside branch');
insert into auth.users(id) values ('df110000-0000-4000-8000-000000000001'),('df110000-0000-4000-8000-000000000002');
insert into public.profiles(id,branch_code,full_name,is_active,activated_at)
values ('df110000-0000-4000-8000-000000000001','QSHQA','[UJI] QSHE reader',true,now()),('df110000-0000-4000-8000-000000000002','QSHQA','[UJI] HRGA fixture owner',true,now());
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason)
values ('df110000-0000-4000-8000-000000000001','QSHQA','qshe','Synthetic branch read regression'),('df110000-0000-4000-8000-000000000002','QSHQA','hrga','Synthetic fixture setup'),('df110000-0000-4000-8000-000000000002','QSHQB','hrga','Synthetic fixture setup');
insert into public.employee_directory(id,branch_code,full_name,employment_status,verification_status,is_active)
select ('df120000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=3 then 'QSHQB' else 'QSHQA' end,'[UJI] Employee without portfolio '||i,'active','verified',true from generate_series(1,3)i;
insert into public.certificate_types(id,branch_code,code,name,category)
values ('df130000-0000-4000-8000-000000000001','QSHQA','QSHQA','[UJI] Competency','personnel'),('df130000-0000-4000-8000-000000000002','QSHQB','QSHQB','[UJI] Competency','personnel');
insert into public.personnel_certificates(id,branch_code,employee_id,certificate_type_id,original_title,issue_date,expiry_date)
select ('df140000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=3 then 'QSHQB' else 'QSHQA' end,('df120000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=3 then 'df130000-0000-4000-8000-000000000002'::uuid else 'df130000-0000-4000-8000-000000000001'::uuid end,'[UJI] Competency','2025-01-01','2026-01-01' from generate_series(1,3)i;
select set_config('request.jwt.claim.sub','df110000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
insert into public.personnel_renewal_cases(branch_code,certificate_id,status,notes)
select branch_code,id,'processing','[UJI] QSHE read regression' from public.personnel_certificates where id::text like 'df140000-%';
select set_config('request.jwt.claim.sub','df110000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
set local role authenticated;
select pg_temp.assert_qshe((select count(*)=2 from public.personnel_certificate_portfolios where branch_code='QSHQA'),'list includes employees without portfolios');
select pg_temp.assert_qshe((select count(*)=2 from public.personnel_renewal_cases where branch_code='QSHQA'),'all renewal cards visible');
select pg_temp.assert_qshe((select count(*)=0 from public.personnel_certificates where branch_code='QSHQB'),'other branch certificates hidden');
select pg_temp.assert_qshe((select count(*)=0 from public.personnel_renewal_cases where branch_code='QSHQB'),'other branch renewals hidden');
do $$ declare changed integer; begin
 update public.personnel_certificates set notes='Forbidden' where branch_code='QSHQA';
 get diagnostics changed=row_count;
 perform pg_temp.assert_qshe(changed=0,'certificate edits denied');
 update public.personnel_renewal_cases set notes='Forbidden' where branch_code='QSHQA';
 get diagnostics changed=row_count;
 perform pg_temp.assert_qshe(changed=0,'renewal edits denied');
 perform pg_temp.assert_qshe(not private.import_role_scope('QSHQA','personnel'),'personnel import denied');
end $$;
reset role;
select 'PASS: QSHE sees all branch certificates and renewals, with no writes/imports or cross-branch access' as result;
rollback;
