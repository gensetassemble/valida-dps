begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
create function pg_temp.assert_commercial(v boolean,msg text) returns void language plpgsql as $$begin if v is distinct from true then raise exception 'Commercial scope: %',msg;end if;end$$;
insert into public.branches(code,name) values('CMT','[CONTOH] Other commercial branch');
insert into auth.users(id,email) values
('cb100000-0000-4000-8000-000000000001','am-commercial@example.invalid'),
('cb100000-0000-4000-8000-000000000002','pdos-commercial@example.invalid'),
('cb100000-0000-4000-8000-000000000003','head-commercial@example.invalid'),
('cb100000-0000-4000-8000-000000000004','tester-commercial@example.invalid');
insert into public.profiles(id,branch_code,full_name,is_active) select id,'DPS','[CONTOH] Commercial QA',true from auth.users where id::text like 'cb100000-%';
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason) values
('cb100000-0000-4000-8000-000000000001','DPS','account_manager','[CONTOH] QA'),
('cb100000-0000-4000-8000-000000000002','DPS','account_manager','[CONTOH] PDOS commercial role'),
('cb100000-0000-4000-8000-000000000002','DPS','department_head','[CONTOH] PDOS head role'),
('cb100000-0000-4000-8000-000000000003','DPS','department_head','[CONTOH] Other head'),
('cb100000-0000-4000-8000-000000000004','DPS','tester','[CONTOH] Read only');
insert into public.clients(id,branch_code,name) values('cb200000-0000-4000-8000-000000000001','DPS','[CONTOH] Unassigned client'),('cb200000-0000-4000-8000-000000000002','CMT','[CONTOH] Other branch client');
insert into public.certificate_types(id,branch_code,code,name,category) values('cb300000-0000-4000-8000-000000000001','DPS','COMM_QA','[CONTOH] Client type','client'),('cb300000-0000-4000-8000-000000000002','CMT','COMM_QA_OTHER','[CONTOH] Other type','client');
select set_config('request.jwt.claim.sub','cb100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
set local role authenticated;
select pg_temp.assert_commercial((select count(*)=1 from public.clients where id='cb200000-0000-4000-8000-000000000001'),'AM can select unassigned customer for certificate');
insert into public.client_certificates(id,branch_code,client_id,certificate_type_id,certificate_number,object_type) values('cb400000-0000-4000-8000-000000000001','DPS','cb200000-0000-4000-8000-000000000001','cb300000-0000-4000-8000-000000000001','[CONTOH] CMT-01','Fixture');
update public.client_certificates set object_type='AM updated' where id='cb400000-0000-4000-8000-000000000001';
select pg_temp.assert_commercial((select object_type='AM updated' from public.client_certificate_display_records where id='cb400000-0000-4000-8000-000000000001'),'AM updates certificate outside ownership');
select pg_temp.assert_commercial(private.document_scope('DPS','client','cb400000-0000-4000-8000-000000000001',true),'AM can attach certificate evidence');
select pg_temp.assert_commercial(not private.client_scope('DPS','cb200000-0000-4000-8000-000000000001',true),'customer ownership administration unchanged');
do $$begin
 begin insert into public.client_certificates(branch_code,client_id,certificate_type_id,certificate_number,object_type) values('CMT','cb200000-0000-4000-8000-000000000002','cb300000-0000-4000-8000-000000000002','[CONTOH] denied','Fixture');raise exception 'FAIL cross branch';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','cb100000-0000-4000-8000-000000000002',true);
update public.client_certificates set object_type='PDOS updated' where id='cb400000-0000-4000-8000-000000000001';
select pg_temp.assert_commercial((select object_type='PDOS updated' from public.client_certificate_display_records where id='cb400000-0000-4000-8000-000000000001'),'PDOS commercial head can edit');
select set_config('request.jwt.claim.sub','cb100000-0000-4000-8000-000000000003',true);
update public.client_certificates set object_type='Other head denied' where id='cb400000-0000-4000-8000-000000000001';
select pg_temp.assert_commercial((select object_type='PDOS updated' from public.client_certificate_display_records where id='cb400000-0000-4000-8000-000000000001'),'other department heads stay read only');
select set_config('request.jwt.claim.sub','cb100000-0000-4000-8000-000000000004',true);
update public.client_certificates set object_type='Tester denied' where id='cb400000-0000-4000-8000-000000000001';
select pg_temp.assert_commercial((select object_type='PDOS updated' from public.client_certificate_display_records where id='cb400000-0000-4000-8000-000000000001'),'tester stays read only');
reset role;
select pass('Shared DPS certificate writes, PDOS dual role, evidence, customer ownership and branch/read-only boundaries');
select * from finish();
rollback;
