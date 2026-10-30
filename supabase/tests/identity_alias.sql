begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
create function pg_temp.alias_assert(v boolean,msg text) returns void language plpgsql as $$begin if v is distinct from true then raise exception 'Identity alias: %',msg;end if;end $$;
insert into public.branches(code,name) values('AIX','[CONTOH] Alias other branch');
insert into auth.users(id,email) values('ab100000-0000-4000-8000-000000000001','alias.admin.qa@example.invalid');
insert into public.employee_directory(id,branch_code,full_name,npp) values
 ('ab200000-0000-4000-8000-000000000001','DPS','[CONTOH] Canonical Identity','95381'),
 ('ab200000-0000-4000-8000-000000000002','DPS','[CONTOH] Original Identity',null),
 ('ab200000-0000-4000-8000-000000000003','AIX','[CONTOH] Another Branch','95382');
insert into public.profiles(id,employee_id,branch_code,full_name,is_active) values('ab100000-0000-4000-8000-000000000001','ab200000-0000-4000-8000-000000000001','DPS','[CONTOH] Alias Admin',true);
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason) values('ab100000-0000-4000-8000-000000000001','DPS','admin','[CONTOH] Rollback alias regression');
update public.employee_directory set merged_into_employee_id='ab200000-0000-4000-8000-000000000001',merged_at=now(),merge_reason='[CONTOH] Reviewed identity consolidation' where id='ab200000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','ab100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.alias_assert((select count(*)=1 from public.employee_directory_records where id in('ab200000-0000-4000-8000-000000000001','ab200000-0000-4000-8000-000000000002')),'directory shows one identity');
select pg_temp.alias_assert((select full_name='[CONTOH] Original Identity' and merged_into_employee_id='ab200000-0000-4000-8000-000000000001' from public.employee_directory where id='ab200000-0000-4000-8000-000000000002'),'original record and alias retained');
select pg_temp.alias_assert(not exists(select 1 from public.employee_directory_records where branch_code='AIX'),'view preserves branch RLS');
do $$begin begin update public.employee_directory set merged_into_employee_id='ab200000-0000-4000-8000-000000000003' where id='ab200000-0000-4000-8000-000000000002';raise exception 'Expected cross branch FK denial';exception when foreign_key_violation then null;end;end $$;
reset role;
select pg_temp.alias_assert(exists(select 1 from public.audit_logs where table_name='employee_directory' and record_id='ab200000-0000-4000-8000-000000000002' and action='UPDATE'),'merge metadata audited');
select pass('Canonical directory hides reviewed aliases, preserves original identity, audit and branch RLS');
select * from finish();
rollback;
