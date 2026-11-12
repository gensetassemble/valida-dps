begin;
-- Isolated development fixtures; every change is rolled back.
create function pg_temp.assert_equipment_delete(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',message; end if; end $$;
insert into public.branches(code,name) values('EDEL','[UJI] Equipment deletion');
insert into auth.users(id) values('ed110000-0000-4000-8000-000000000001'),('ed110000-0000-4000-8000-000000000002'),('ed110000-0000-4000-8000-000000000003');
insert into public.employee_directory(id,branch_code,full_name,employment_status,verification_status,is_active)
select ('ed120000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'EDEL','[UJI] Deletion user '||i,'active','verified',true from generate_series(1,3)i;
insert into public.profiles(id,employee_id,branch_code,full_name,is_active)
select ('ed110000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('ed120000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'EDEL','[UJI] Deletion user '||i,true from generate_series(1,3)i;
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason)
select ('ed110000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'EDEL',(array['super_admin','equipment_manager','coordinator'])[i],'[UJI] Rollback deletion regression' from generate_series(1,3)i;
insert into public.equipment(id,branch_code,name,is_active)
select ('ed130000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'EDEL','[UJI] Equipment '||i,i=2 from generate_series(1,3)i;
insert into public.calibrations(branch_code,equipment_id) values('EDEL','ed130000-0000-4000-8000-000000000003');
select set_config('request.jwt.claim.sub','ed110000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
set local role authenticated;
delete from public.equipment where branch_code='EDEL';
reset role;
select pg_temp.assert_equipment_delete((select count(*)=3 from public.equipment where branch_code='EDEL'),'MFA must be required');
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
select set_config('request.jwt.claim.sub','ed110000-0000-4000-8000-000000000002',true);
set local role authenticated;
delete from public.equipment where branch_code='EDEL';
reset role;
select pg_temp.assert_equipment_delete((select count(*)=3 from public.equipment where branch_code='EDEL'),'PTK must not delete equipment permanently');
select set_config('request.jwt.claim.sub','ed110000-0000-4000-8000-000000000001',true);
set local role authenticated;
delete from public.equipment where id='ed130000-0000-4000-8000-000000000002';
do $$begin
 begin
  delete from public.equipment where id='ed130000-0000-4000-8000-000000000003';
  raise exception 'Expected dependency refusal';
 exception when raise_exception then
  if sqlerrm not like 'Alat masih memiliki riwayat%' then raise;end if;
 end;
end $$;
delete from public.equipment where id='ed130000-0000-4000-8000-000000000001';
reset role;
select pg_temp.assert_equipment_delete((select count(*)=2 from public.equipment where branch_code='EDEL'),'Only unreferenced archived equipment may be deleted');
select pg_temp.assert_equipment_delete(exists(select 1 from public.audit_logs where table_name='equipment' and action='DELETE' and record_id='ed130000-0000-4000-8000-000000000001'),'Deletion audit must remain');
insert into public.portfolios(id,branch_code,code,name) values
('ed140000-0000-4000-8000-000000000001','EDEL','P1','[UJI] Assigned'),
('ed140000-0000-4000-8000-000000000002','EDEL','P2','[UJI] Outside scope');
insert into public.equipment(id,branch_code,name,is_active,portfolio_id)
select ('ed130000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'EDEL','[UJI] Scoped equipment '||i,false,
case when i=5 then 'ed140000-0000-4000-8000-000000000002'::uuid else 'ed140000-0000-4000-8000-000000000001'::uuid end from generate_series(4,6)i;
insert into public.employee_portfolio_assignments(employee_id,portfolio_id,branch_code,assignment_type,effective_from,verification_status,is_active)
select ('ed120000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'ed140000-0000-4000-8000-000000000001','EDEL',case when i=2 then 'equipment_responsible' else 'coordinator' end,'2020-01-01','verified',true from generate_series(2,3)i;
select set_config('request.jwt.claim.sub','ed110000-0000-4000-8000-000000000002',true);
set local role authenticated;
delete from public.equipment where id='ed130000-0000-4000-8000-000000000005';
delete from public.equipment where id='ed130000-0000-4000-8000-000000000004';
reset role;
select pg_temp.assert_equipment_delete(not exists(select 1 from public.equipment where id='ed130000-0000-4000-8000-000000000004'),'PTK may delete its scoped archived equipment');
select pg_temp.assert_equipment_delete(exists(select 1 from public.equipment where id='ed130000-0000-4000-8000-000000000005'),'PTK cannot delete outside its scope');
select set_config('request.jwt.claim.sub','ed110000-0000-4000-8000-000000000003',true);
set local role authenticated;
delete from public.equipment where id='ed130000-0000-4000-8000-000000000005';
delete from public.equipment where id='ed130000-0000-4000-8000-000000000006';
reset role;
select pg_temp.assert_equipment_delete(not exists(select 1 from public.equipment where id='ed130000-0000-4000-8000-000000000006'),'Coordinator may delete its portfolio equipment');
select pg_temp.assert_equipment_delete(exists(select 1 from public.equipment where id='ed130000-0000-4000-8000-000000000005'),'Coordinator cannot delete another portfolio');
select 'Equipment deletion: MFA, responsible roles, portfolio scope, archive, dependencies and audit passed' as result;
rollback;
