begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);

create function pg_temp.assert_import(v boolean,label text)
returns void language plpgsql as $$
begin
  if v is distinct from true then raise exception 'Import role access: %',label;end if;
end $$;

insert into auth.users(id,email) values
('da100000-0000-4000-8000-000000000001','import-admin@example.invalid'),
('da100000-0000-4000-8000-000000000002','import-hrga@example.invalid'),
('da100000-0000-4000-8000-000000000003','import-am@example.invalid'),
('da100000-0000-4000-8000-000000000004','import-ptk@example.invalid'),
('da100000-0000-4000-8000-000000000005','import-coordinator@example.invalid');
insert into public.profiles(id,branch_code,full_name,is_active,activated_at)
select id,'DPS','[CONTOH] Import role '||row_number() over(),true,now()
from auth.users where id::text like 'da100000-%';
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason) values
('da100000-0000-4000-8000-000000000001','DPS','admin','[CONTOH] Access test'),
('da100000-0000-4000-8000-000000000002','DPS','hrga','[CONTOH] Access test'),
('da100000-0000-4000-8000-000000000003','DPS','account_manager','[CONTOH] Access test'),
('da100000-0000-4000-8000-000000000004','DPS','equipment_manager','[CONTOH] Access test'),
('da100000-0000-4000-8000-000000000005','DPS','coordinator','[CONTOH] Access test');
insert into public.import_batches(id,branch_code,domain,filename,file_hash,file_bytes,source_count,created_by) values
('da200000-0000-4000-8000-000000000001','DPS','employees','employees.csv',repeat('1',64),10,1,'da100000-0000-4000-8000-000000000001'),
('da200000-0000-4000-8000-000000000002','DPS','personnel','personnel.csv',repeat('2',64),10,1,'da100000-0000-4000-8000-000000000002'),
('da200000-0000-4000-8000-000000000003','DPS','clients','clients.csv',repeat('3',64),10,1,'da100000-0000-4000-8000-000000000003'),
('da200000-0000-4000-8000-000000000004','DPS','calibrations','calibrations.csv',repeat('4',64),10,1,'da100000-0000-4000-8000-000000000004');

set local role authenticated;
select set_config('request.jwt.claims','{"aal":"aal2"}',true);

select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000001',true);
select pg_temp.assert_import(private.import_role_scope('DPS','employees'),'Admin keeps employee master import');
select pg_temp.assert_import(not private.import_role_scope('DPS','personnel') and not private.import_role_scope('DPS','clients') and not private.import_role_scope('DPS','calibrations'),'Admin has no implicit operational document import');
select pg_temp.assert_import(not exists(select 1 from public.import_batches where domain<>'employees') and exists(select 1 from public.import_batches where id='da200000-0000-4000-8000-000000000001'),'Admin sees only employee import history');

select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000002',true);
select pg_temp.assert_import(private.import_role_scope('DPS','personnel'),'HRGA imports personnel competency certificates');
select pg_temp.assert_import(not exists(select 1 from public.import_batches where domain<>'personnel') and exists(select 1 from public.import_batches where id='da200000-0000-4000-8000-000000000002'),'HRGA sees only personnel import history');

select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000003',true);
select pg_temp.assert_import(private.import_role_scope('DPS','clients'),'AM/Marketing/PDOS imports client certificates');
select pg_temp.assert_import(not exists(select 1 from public.import_batches where domain<>'clients') and exists(select 1 from public.import_batches where id='da200000-0000-4000-8000-000000000003'),'Commercial role sees only client import history');

select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000004',true);
select pg_temp.assert_import(private.import_role_scope('DPS','calibrations'),'PTK imports calibration documents');
select pg_temp.assert_import(not exists(select 1 from public.import_batches where domain<>'calibrations') and exists(select 1 from public.import_batches where id='da200000-0000-4000-8000-000000000004'),'PTK sees only calibration import history');

select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000005',true);
select pg_temp.assert_import(not private.import_role_scope('DPS','employees') and not private.import_role_scope('DPS','personnel') and not private.import_role_scope('DPS','clients') and not private.import_role_scope('DPS','calibrations'),'Coordinator receives no import permission');
select pg_temp.assert_import((select count(*)=0 from public.import_batches),'Coordinator sees no import history');

select pass('Document import access follows HRGA, commercial and PTK responsibility');
select * from finish();
rollback;
