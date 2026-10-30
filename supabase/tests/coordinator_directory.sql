begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
create function pg_temp.coordinator_assert(v boolean) returns void language plpgsql as $$begin if v is distinct from true then raise exception 'Coordinator directory assertion failed';end if;end $$;
insert into public.branches(code,name) values('QAC','[CONTOH] Other branch');
insert into auth.users(id,email) values('ec100000-0000-4000-8000-000000000001','coordinator.admin.qa@example.invalid'),('ec100000-0000-4000-8000-000000000002','coordinator.reader.qa@example.invalid');
insert into public.employee_directory(id,branch_code,full_name,npp,employment_status,verification_status,is_active) values
 ('ec200000-0000-4000-8000-000000000001','DPS','[CONTOH] Directory Admin','93571','active','verified',true),
 ('ec200000-0000-4000-8000-000000000002','DPS','[CONTOH] Directory Reader','93572','active','verified',true);
insert into public.profiles(id,employee_id,branch_code,full_name,is_active,activated_at) values
 ('ec100000-0000-4000-8000-000000000001','ec200000-0000-4000-8000-000000000001','DPS','[CONTOH] Directory Admin',true,now()),
 ('ec100000-0000-4000-8000-000000000002','ec200000-0000-4000-8000-000000000002','DPS','[CONTOH] Directory Reader',true,now());
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason) values
 ('ec100000-0000-4000-8000-000000000001','DPS','admin','[CONTOH] Rollback directory test'),
 ('ec100000-0000-4000-8000-000000000002','DPS','qshe','[CONTOH] Rollback directory test');
insert into public.operational_coordinators(id,branch_code,full_name) values('ec300000-0000-4000-8000-000000000002','QAC','[CONTOH] Other branch contact');
select set_config('request.jwt.claim.sub','ec100000-0000-4000-8000-000000000001',true);
set local role authenticated;
insert into public.operational_coordinators(id,branch_code,full_name,email,coverage) values('ec300000-0000-4000-8000-000000000001','DPS','[CONTOH] Contact QA','contact.qa@example.invalid','[CONTOH] Portfolio');
update public.operational_coordinators set whatsapp='0800000000' where id='ec300000-0000-4000-8000-000000000001';
select pg_temp.coordinator_assert((select created_by=auth.uid() and updated_by=auth.uid() and whatsapp='0800000000' from public.operational_coordinators where id='ec300000-0000-4000-8000-000000000001'));
select pg_temp.coordinator_assert(not exists(select 1 from public.operational_coordinators where branch_code='QAC'));
do $$begin begin update public.operational_coordinators set branch_code='QAC' where id='ec300000-0000-4000-8000-000000000001';raise exception 'Expected cross-branch rejection';exception when insufficient_privilege then null;end;end $$;
select set_config('request.jwt.claim.sub','ec100000-0000-4000-8000-000000000002',true);
select pg_temp.coordinator_assert(exists(select 1 from public.operational_coordinators where id='ec300000-0000-4000-8000-000000000001'));
do $$begin begin insert into public.operational_coordinators(branch_code,full_name) values('DPS','[CONTOH] Forbidden reader write');raise exception 'Expected reader rejection';exception when insufficient_privilege then null;end;end $$;
select pg_temp.coordinator_assert(not has_table_privilege('authenticated','public.operational_coordinators','DELETE'));
reset role;
select pg_temp.coordinator_assert(exists(select 1 from public.audit_logs where table_name='operational_coordinators' and record_id='ec300000-0000-4000-8000-000000000001'));
select pass('Coordinator branch isolation, admin CRUD, reader scope, metadata and audit');
select * from finish();
rollback;
