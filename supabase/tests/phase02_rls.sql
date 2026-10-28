-- Synthetic identities and records exist only inside this rolled-back transaction.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
create function pg_temp.assert_true(v boolean,label text) returns void language plpgsql as $$
begin if v is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
insert into public.branches(code,name) values('TEST','[CONTOH] Cabang Uji');
insert into public.work_areas(id,name,branch_code) values('80000000-0000-4000-8000-000000000001','[CONTOH] Wilayah Cabang Lain','TEST');
insert into public.portfolios(id,code,name,branch_code) values
 ('40000000-0000-4000-8000-000000000001','UJI_P1','[CONTOH] Portofolio Satu','DPS'),
 ('40000000-0000-4000-8000-000000000002','UJI_P2','[CONTOH] Portofolio Dua','DPS');
insert into auth.users(id) select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,11)n;
insert into public.employee_directory(id,full_name,npp,branch_code,employment_status,verification_status,is_active)
 select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'[CONTOH] Pegawai Uji '||n,lpad(n::text,6,'0'),case when n=11 then 'TEST' else 'DPS' end,'active','verified',true from generate_series(1,12)n;
insert into public.profiles(id,employee_id,branch_code,is_active,activated_at,full_name)
 select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case when n=11 then 'TEST' else 'DPS' end,n<>10,case when n<>10 then now() end,'[CONTOH] Akun Uji '||n from generate_series(1,11)n;
insert into public.user_role_assignments(profile_id,role_code,branch_code,grant_reason)
 select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 (array['admin','account_manager','account_manager','hrga','coordinator','qshe','equipment_manager','inspector','branch_head','admin','admin'])[n],
 case when n=11 then 'TEST' else 'DPS' end,'[CONTOH] Penugasan pengujian RLS.' from generate_series(1,11)n;
insert into public.user_role_assignments(profile_id,role_code,branch_code,grant_reason)
 values('20000000-0000-4000-8000-000000000005','inspector','DPS','[CONTOH] Peran tambahan terotorisasi.');
insert into public.employee_portfolio_assignments(employee_id,portfolio_id,assignment_type,verification_status)
 values
 ('30000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000001','coordinator','verified'),
 ('30000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000001','qshe','verified'),
 ('30000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000001','equipment_responsible','verified'),
 ('30000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000001','personnel','verified'),
 ('30000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000002','personnel','verified'),
 ('30000000-0000-4000-8000-000000000012','40000000-0000-4000-8000-000000000002','personnel','verified');
insert into public.clients(id,name,account_manager_id,portfolio_id) values
 ('50000000-0000-4000-8000-000000000001','[CONTOH] Klien A','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001'),
 ('50000000-0000-4000-8000-000000000002','[CONTOH] Klien B','20000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000002');
insert into public.clients(id,name,branch_code) values ('50000000-0000-4000-8000-000000000003','[CONTOH] Klien Cabang Lain','TEST');
insert into public.client_contacts(client_id,name) values('50000000-0000-4000-8000-000000000001','[CONTOH] Kontak A');
insert into public.client_certificates(id,client_id,certificate_type_id,certificate_number)
 select '60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',id,'000001/CONTOH' from public.certificate_types where code='CONTOH_KLIEN' and branch_code='DPS';
insert into public.personnel_certificates(employee_id,certificate_type_id)
 select e,id from public.certificate_types cross join unnest(array['30000000-0000-4000-8000-000000000008'::uuid,'30000000-0000-4000-8000-000000000012'::uuid])e where code='CONTOH_PERSONEL' and branch_code='DPS';
insert into public.equipment(id,name,ownership,portfolio_id) values
 ('70000000-0000-4000-8000-000000000001','[CONTOH] Peralatan P1','internal','40000000-0000-4000-8000-000000000001'),
 ('70000000-0000-4000-8000-000000000002','[CONTOH] Peralatan P2','internal','40000000-0000-4000-8000-000000000002');
insert into public.calibrations(equipment_id) values('70000000-0000-4000-8000-000000000001'),('70000000-0000-4000-8000-000000000002');
insert into storage.objects(bucket_id,name) values('certificate-documents','phase02-metadata-only.pdf');

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true((select count(*)=1 from public.clients),'AM A sees only its client');
select pg_temp.assert_true((select count(*)=1 from public.client_contacts),'AM A sees its contact');
select pg_temp.assert_true((select count(*)=1 from public.client_certificates),'AM A sees its certificate');
select pg_temp.assert_true((select count(*)=0 from public.employee_directory),'AM cannot read employee directory');
update public.clients set name='[CONTOH] Klien A Diubah' where id='50000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select name='[CONTOH] Klien A Diubah' from public.clients where id='50000000-0000-4000-8000-000000000001'),'AM authorized update is real');
do $$ begin
 begin update public.clients set account_manager_id='20000000-0000-4000-8000-000000000003' where id='50000000-0000-4000-8000-000000000001'; raise exception 'FAIL: AM reassigns owner'; exception when insufficient_privilege then null; end;
 begin update public.clients set branch_code='TEST' where id='50000000-0000-4000-8000-000000000001'; raise exception 'FAIL: AM changes branch'; exception when insufficient_privilege then null; end;
 begin insert into public.user_role_assignments(profile_id,role_code,grant_reason) values(auth.uid(),'admin','[CONTOH] Escalation'); raise exception 'FAIL: self grant'; exception when insufficient_privilege then null; end;
 begin insert into public.client_contacts(client_id,name) values('50000000-0000-4000-8000-000000000002','[CONTOH] Unauthorized contact'); raise exception 'FAIL: cross-client contact'; exception when insufficient_privilege then null; end;
 begin update public.audit_logs set action='DELETE'; raise exception 'FAIL: audit mutation'; exception when insufficient_privilege then null; end;
 begin insert into storage.objects(bucket_id,name) values('certificate-documents','blocked.pdf'); raise exception 'FAIL: storage upload'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.assert_true((select count(*)=0 from storage.objects where bucket_id='certificate-documents'),'private storage has a row but remains invisible');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true((select count(*)=2 from public.clients where id in ('50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003')),'Admin DPS cannot see other branch');
do $$ begin
 begin insert into public.user_role_assignments(profile_id,role_code,grant_reason) values(auth.uid(),'hrga','[CONTOH] Admin self grant'); raise exception 'FAIL: Admin grants own role'; exception when insufficient_privilege then null; end;
 begin insert into public.clients(name,work_area_id) values('[CONTOH] Cross-branch FK','80000000-0000-4000-8000-000000000001'); raise exception 'FAIL: cross-branch FK'; exception when foreign_key_violation then null; end;
 begin update public.certificate_types set category='personnel' where code='CONTOH_KLIEN'; raise exception 'FAIL: rewrite referenced category'; exception when check_violation then null; end;
end $$;
select pg_temp.assert_true(not has_table_privilege(current_user,'public.audit_logs','DELETE'),'audit deletion privilege is denied');
update public.user_role_assignments set granted_by='20000000-0000-4000-8000-000000000003',granted_at='1900-01-01' where profile_id='20000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select granted_by is null and granted_at>'2000-01-01' from public.user_role_assignments where profile_id='20000000-0000-4000-8000-000000000002'),'grant actor and timestamp cannot be forged');
update public.clients set account_manager_id='20000000-0000-4000-8000-000000000003',assignment_reason='[CONTOH] Pengalihan untuk pengujian.' where id='50000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select count(*)=1 from public.client_certificates where id='60000000-0000-4000-8000-000000000001' and client_id='50000000-0000-4000-8000-000000000001'),'reassignment preserves certificate parent');
select pg_temp.assert_true((select count(*)=2 from public.client_assignment_history where client_id='50000000-0000-4000-8000-000000000001'),'assignment history appended');
do $$ begin
 begin insert into public.clients(name,work_area_id) values('[CONTOH] Invalid FK','99999999-0000-4000-8000-000000000001'); raise exception 'FAIL: invalid FK'; exception when foreign_key_violation then null; end;
 begin insert into public.client_certificates(client_id,certificate_type_id) select '50000000-0000-4000-8000-000000000001',id from public.certificate_types where code='CONTOH_PERSONEL'; raise exception 'FAIL: category mismatch'; exception when check_violation then null; end;
 begin insert into public.clients(name,branch_code) values('[CONTOH] Cross branch write','TEST'); raise exception 'FAIL: cross branch insert'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true((select count(*)=0 from public.clients),'old AM loses client immediately');
select pg_temp.assert_true((select count(*)=0 from public.client_certificates),'old AM loses certificate immediately');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_true((select count(*)=2 from public.clients),'new AM gains both clients');
select pg_temp.assert_true((select count(*)=1 from public.client_certificates),'new AM gains existing certificate without copying it');
do $$ begin begin update public.client_contacts set client_id='50000000-0000-4000-8000-000000000002' where client_id='50000000-0000-4000-8000-000000000001'; raise exception 'FAIL: reparent contact'; exception when insufficient_privilege then null; end; end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000004',true);
insert into public.employee_directory(full_name,employment_status) values('[CONTOH] Pegawai HRGA','unknown');
update public.personnel_certificates set issuer='[CONTOH] Penerbit belum diverifikasi';
select pg_temp.assert_true((select count(*)=2 from public.personnel_certificates),'HRGA controls branch personnel records');
do $$ begin begin insert into public.employee_portfolio_assignments(employee_id,portfolio_id,assignment_type,verification_status) values('30000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000002','coordinator','verified'); raise exception 'FAIL: HRGA self expands monitoring scope'; exception when insufficient_privilege then null; end; end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000005',true);
select pg_temp.assert_true((select count(*)=2 from public.user_role_assignments where profile_id=auth.uid()),'one account has multiple roles');
select pg_temp.assert_true((select count(*)=1 from public.personnel_certificates),'coordinator limited to assigned portfolio');
do $$ declare n integer; begin update public.personnel_certificates set verification_status='verified'; get diagnostics n=row_count; if n<>0 then raise exception 'FAIL: coordinator approves official competency'; end if; end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000006',true);
select pg_temp.assert_true((select count(*)=1 from public.clients),'QSHE limited to assigned portfolio clients');
select pg_temp.assert_true((select count(*)=1 from public.equipment),'QSHE limited to assigned assets');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000007',true);
select pg_temp.assert_true((select count(*)=1 from public.equipment),'PJ limited to assigned assets');
update public.calibrations set laboratory='[CONTOH] Laboratorium Uji';
select pg_temp.assert_true((select count(*)=1 from public.calibrations where laboratory='[CONTOH] Laboratorium Uji'),'PJ updates authorized calibration');
do $$ begin begin insert into public.equipment(name,ownership,portfolio_id) values('[CONTOH] Outside scope','internal','40000000-0000-4000-8000-000000000002'); raise exception 'FAIL: asset outside portfolio'; exception when insufficient_privilege then null; end; end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000008',true);
select pg_temp.assert_true((select count(*)=1 from public.personnel_certificates),'inspector sees own certificates only');
select pg_temp.assert_true((select count(*)=2 from public.employee_portfolio_assignments),'one employee has two portfolios');
select pg_temp.assert_true((select npp='000008' from public.employee_directory),'NPP preserves leading zeroes');
do $$ declare n integer; begin update public.personnel_certificates set verification_status='verified'; get diagnostics n=row_count; if n<>0 then raise exception 'FAIL: inspector approves license'; end if; end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000009',true);
select pg_temp.assert_true((select count(*)=2 from public.clients where id in ('50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003')),'branch head reads branch-wide business');
do $$ declare n integer; begin update public.clients set name='[CONTOH] Unauthorized head edit'; get diagnostics n=row_count; if n<>0 then raise exception 'FAIL: branch head writes'; end if; end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000010',true);
select pg_temp.assert_true((select count(*)=0 from public.clients),'inactive identity denied');
select pg_temp.assert_true((select count(*)=0 from public.profiles),'inactive identity cannot read profiles');
do $$ declare n integer; begin update public.profiles set is_active=true where id=auth.uid(); get diagnostics n=row_count; if n<>0 then raise exception 'FAIL: inactive user self activation'; end if; end $$;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000012',true);
select pg_temp.assert_true(not private.actor_enabled(),'directory-only identity cannot become authenticated actor');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000011',true);
update public.branches set region='[CONTOH] Wilayah Uji' where code='TEST';
select pg_temp.assert_true((select region='[CONTOH] Wilayah Uji' from public.branches where code='TEST'),'other branch Admin edits only its authorized branch');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
update public.user_role_assignments set is_active=false,grant_reason='[CONTOH] Pencabutan uji.' where profile_id='20000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_true((select count(*)=0 from public.clients),'revoked role loses access without JWT refresh');
set local role anon;
do $$ begin begin perform * from public.clients; raise exception 'FAIL: anonymous read'; exception when insufficient_privilege then null; end; end $$;
reset role;
select pg_temp.assert_true(exists(select 1 from public.audit_logs where table_name='clients' and action='UPDATE'),'business mutations are audited');
select pg_temp.assert_true((select count(*)=0 from auth.users where id='30000000-0000-4000-8000-000000000012'),'directory never creates an Auth account');
select pass('Phase 02: branch/AM/portfolio roles, real CRUD, revocation, FK/category integrity, immutable audit, private storage');
select * from finish();
rollback;
