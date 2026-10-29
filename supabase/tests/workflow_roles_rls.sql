-- Synthetic, rolled-back tests for the requested workflow capabilities.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
create function pg_temp.assert_true(v boolean,label text) returns void language plpgsql as $$
begin if v is distinct from true then raise exception 'FAIL: %',label;end if;end $$;
insert into auth.users(id) select ('e1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,6)n;
insert into public.employee_directory(id,full_name,branch_code,employment_status,verification_status,is_active)
 select ('e2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'[CONTOH] Workflow RLS '||n,'DPS','active','verified',true from generate_series(1,6)n;
insert into public.profiles(id,employee_id,full_name,branch_code,is_active,activated_at)
 select ('e1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('e2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'[CONTOH] Workflow RLS '||n,'DPS',true,now() from generate_series(1,6)n;
insert into public.user_role_assignments(profile_id,role_code,branch_code,grant_reason)
 select ('e1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,(array['super_admin','tester','department_head','unit_head','branch_head','equipment_manager'])[n],'DPS','[CONTOH] Pengujian role workflow dalam transaksi rollback.' from generate_series(1,6)n;
insert into public.portfolios(id,code,name,branch_code) values
 ('e3000000-0000-4000-8000-000000000001','CONTOH_WF_RLS_A','[CONTOH] Workflow A','DPS'),
 ('e3000000-0000-4000-8000-000000000002','CONTOH_WF_RLS_B','[CONTOH] Workflow B','DPS');
insert into public.employee_portfolio_assignments(employee_id,portfolio_id,assignment_type,verification_status,approved_at)
 values('e2000000-0000-4000-8000-000000000006','e3000000-0000-4000-8000-000000000001','equipment_responsible','verified',now());
insert into public.clients(id,name,branch_code,is_example) values('e4000000-0000-4000-8000-000000000001','[CONTOH] Workflow RLS Pelanggan','DPS',true);
insert into public.equipment(id,name,branch_code,ownership,portfolio_id) values
 ('e5000000-0000-4000-8000-000000000001','[CONTOH] Workflow Alat A','DPS','internal','e3000000-0000-4000-8000-000000000001'),
 ('e5000000-0000-4000-8000-000000000002','[CONTOH] Workflow Alat B','DPS','internal','e3000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true(private.has_role('DPS',array['admin']),'IT Officer administers assigned branch');
select pg_temp.assert_true(not private.has_role('OTHER',array['admin']),'IT Officer cannot administer another branch');
insert into public.work_areas(name,branch_code) values('[CONTOH] Workflow Admin Positive','DPS');
do $$ begin begin
 insert into public.user_role_assignments(profile_id,role_code,branch_code,grant_reason) values(auth.uid(),'hrga','DPS','[CONTOH] Self grant must be denied.');
 raise exception 'FAIL: IT Officer self grant';exception when insufficient_privilege then null;end;end $$;
do $$ declare n integer;changed integer;begin
 for n in 2..5 loop
  perform set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-'||lpad(n::text,12,'0'),true);
  perform pg_temp.assert_true(private.has_role('DPS',array['branch_head']),'read-only branch capability');
  perform pg_temp.assert_true(not private.has_role('DPS',array['admin','hrga','equipment_manager','account_manager']),'read-only roles have no writer capability');
  perform pg_temp.assert_true(not private.has_role('OTHER',array['branch_head']),'read-only roles cannot cross branch');
  perform pg_temp.assert_true((select count(*)=1 from public.clients where id='e4000000-0000-4000-8000-000000000001'),'read-only branch data visible');
  update public.clients set name='[CONTOH] Forbidden workflow edit' where id='e4000000-0000-4000-8000-000000000001';get diagnostics changed=row_count;
  perform pg_temp.assert_true(changed=0,'read-only mutation denied');
  perform pg_temp.assert_true((select count(*)=0 from public.import_batches),'read-only roles cannot view real staging');
  begin insert into public.user_role_assignments(profile_id,role_code,branch_code,grant_reason) values('e1000000-0000-4000-8000-000000000006','admin','DPS','[CONTOH] Forbidden privilege escalation.');raise exception 'FAIL: read-only role grants admin';exception when insufficient_privilege then null;end;
 end loop;
end $$;
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000006',true);
select pg_temp.assert_true((select count(*)=1 from public.equipment where id in ('e5000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000002')),'PTK limited to assigned portfolio');
insert into public.calibrations(equipment_id,branch_code,laboratory) values('e5000000-0000-4000-8000-000000000001','DPS','[CONTOH] Workflow PTK Positive');
do $$ begin begin
 insert into public.calibrations(equipment_id,branch_code) values('e5000000-0000-4000-8000-000000000002','DPS');raise exception 'FAIL: PTK cross-portfolio calibration';exception when insufficient_privilege then null;end;end $$;
select pg_temp.assert_true(not private.has_role('DPS',array['hrga','admin']),'PTK cannot approve personnel or administer users');
reset role;
select pass('Workflow roles: IT Officer branch administration, read-only Tester/heads, denied escalation and PTK portfolio scope');
select * from finish();
rollback;
