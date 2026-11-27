begin;
create function pg_temp.access_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'New account access: %',label;end if;end $$;
insert into public.branches(code,name) values('NEWQA','[UJI] Account access'),('NEWOT','[UJI] Other branch');
insert into public.portfolios(id,branch_code,code,name) values
 ('da210000-0000-4000-8000-000000000001','NEWQA','A','[UJI] Assigned portfolio'),
 ('da210000-0000-4000-8000-000000000002','NEWQA','B','[UJI] Other portfolio');
insert into public.employee_directory(id,branch_code,full_name,is_active,employment_status)
 select ('da220000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'NEWQA','[UJI] Employee '||i,true,'active' from generate_series(1,9)i;
insert into auth.users(id) select ('da230000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,8)i;
insert into public.profiles(id,branch_code,employee_id,full_name,is_active)
 select ('da230000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'NEWQA',('da220000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'[UJI] New account '||i,true from generate_series(1,8)i;
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason)
 select ('da230000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'NEWQA',role,'[UJI] Fresh role grant' from (values (1,'qshe'),(2,'qshe'),(3,'coordinator'),(4,'hrga'),(5,'inspector'),(6,'account_manager'),(7,'equipment_manager')) t(i,role);
insert into public.operational_coordinators(id,branch_code,full_name) values('da240000-0000-4000-8000-000000000001','NEWQA','[UJI] Coordinator contact');
insert into public.portfolio_coordinators(id,branch_code,portfolio_id,coordinator_id,employee_id,effective_from)
 values('da250000-0000-4000-8000-000000000001','NEWQA','da210000-0000-4000-8000-000000000001','da240000-0000-4000-8000-000000000001','da220000-0000-4000-8000-000000000003',current_date-1);
insert into public.employee_portfolio_assignments(branch_code,portfolio_id,employee_id,assignment_type,effective_from,verification_status,is_active) values
 ('NEWQA','da210000-0000-4000-8000-000000000001','da220000-0000-4000-8000-000000000005','personnel',current_date-1,'verified',true),
 ('NEWQA','da210000-0000-4000-8000-000000000001','da220000-0000-4000-8000-000000000007','equipment_responsible',current_date-1,'verified',true);
insert into public.equipment(id,branch_code,portfolio_id,name,ownership) values
 ('da260000-0000-4000-8000-000000000001','NEWQA','da210000-0000-4000-8000-000000000001','[UJI] Tool A','internal'),
 ('da260000-0000-4000-8000-000000000002','NEWQA','da210000-0000-4000-8000-000000000002','[UJI] Tool B','internal'),
 ('da260000-0000-4000-8000-000000000003','NEWOT',null,'[UJI] Outside branch','internal');
insert into public.calibrations(id,branch_code,equipment_id,certificate_number,issue_date,due_date) values
 ('da270000-0000-4000-8000-000000000001','NEWQA','da260000-0000-4000-8000-000000000001','[UJI] CAL A','2026-01-01','2027-01-01'),
 ('da270000-0000-4000-8000-000000000002','NEWQA','da260000-0000-4000-8000-000000000002','[UJI] CAL B','2026-01-01','2027-01-01');
insert into public.certificate_types(id,branch_code,code,name,category) values('da280000-0000-4000-8000-000000000001','NEWQA','TEST','[UJI] Skill','personnel');
insert into public.personnel_certificates(branch_code,employee_id,certificate_type_id,certificate_number,issue_date,expiry_date) values
 ('NEWQA','da220000-0000-4000-8000-000000000005','da280000-0000-4000-8000-000000000001','[UJI] PERSON A','2026-01-01','2027-01-01'),
 ('NEWQA','da220000-0000-4000-8000-000000000009','da280000-0000-4000-8000-000000000001','[UJI] PERSON B','2026-01-01','2027-01-01');
insert into public.clients(id,branch_code,name,portfolio_id,account_manager_id) values
 ('da290000-0000-4000-8000-000000000001','NEWQA','[UJI] Customer A','da210000-0000-4000-8000-000000000001','da230000-0000-4000-8000-000000000006'),
 ('da290000-0000-4000-8000-000000000002','NEWQA','[UJI] Customer B','da210000-0000-4000-8000-000000000002',null);
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
select set_config('request.jwt.claim.sub','da230000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.access_assert((select count(*)=2 from public.equipment),'new QSHE reads every own-branch tool without portfolio grants');
select pg_temp.access_assert((select count(*)=2 from public.calibrations),'new QSHE reads all calibration events');
select pg_temp.access_assert((select count(*)=2 from public.personnel_certificates),'new QSHE reads every personnel certificate');
select pg_temp.access_assert((select count(*)=2 from public.clients),'QSHE reads all branch customers without portfolio grants');
select pg_temp.access_assert(not private.client_scope('NEWQA','da290000-0000-4000-8000-000000000001',true),'QSHE remains read only for customers');
select pg_temp.access_assert(not private.equipment_scope('NEWQA','da260000-0000-4000-8000-000000000001',true),'QSHE remains read only for equipment');
select set_config('request.jwt.claim.sub','da230000-0000-4000-8000-000000000002',true);
select pg_temp.access_assert((select count(*)=2 from public.equipment) and (select count(*)=2 from public.personnel_certificates),'a second new QSHE inherits the same visibility automatically');
select set_config('request.jwt.claim.sub','da230000-0000-4000-8000-000000000003',true);
select pg_temp.access_assert((select count(*)=1 from public.equipment),'coordinator appointment grants own portfolio without duplicate access assignment');
select pg_temp.access_assert((select count(*)=1 from public.equipment_monitoring_records),'coordinator monitoring follows same scope');
select pg_temp.access_assert((select count(*)=1 from public.calibrations),'coordinator sees own portfolio calibration events');
select pg_temp.access_assert((select count(*)=1 from public.personnel_certificates),'coordinator sees personnel assigned to own portfolio');
select pg_temp.access_assert(not private.equipment_scope('NEWQA','da260000-0000-4000-8000-000000000001',true),'coordinator appointment does not grant equipment mutation rights');
select pg_temp.access_assert(not private.portfolio_scope('NEWQA','da210000-0000-4000-8000-000000000002'),'coordinator cannot cross portfolios');
select set_config('request.jwt.claim.sub','da230000-0000-4000-8000-000000000004',true);
select pg_temp.access_assert((select count(*)=2 from public.personnel_certificates),'new HRGA inherits full branch personnel visibility');
select pg_temp.access_assert((select count(*)=0 from public.equipment),'HRGA does not gain equipment access');
select set_config('request.jwt.claim.sub','da230000-0000-4000-8000-000000000005',true);
select pg_temp.access_assert((select count(*)=1 from public.personnel_certificates),'personnel sees own certificates only');
select set_config('request.jwt.claim.sub','da230000-0000-4000-8000-000000000006',true);
select pg_temp.access_assert((select count(*)=2 from public.clients),'new AM reads branch customers');
select pg_temp.access_assert(private.client_scope('NEWQA','da290000-0000-4000-8000-000000000001',true) and not private.client_scope('NEWQA','da290000-0000-4000-8000-000000000002',true),'AM edits assigned customers only');
select set_config('request.jwt.claim.sub','da230000-0000-4000-8000-000000000007',true);
select pg_temp.access_assert((select count(*)=1 from public.equipment),'new PTK inherits assigned portfolio visibility');
select set_config('request.jwt.claim.sub','da230000-0000-4000-8000-000000000008',true);
select pg_temp.access_assert((select count(*)=0 from public.equipment) and (select count(*)=0 from public.personnel_certificates),'unassigned account receives no implicit access');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.portfolio_coordinators set is_active=false where id='da250000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','da230000-0000-4000-8000-000000000003',true);
set local role authenticated;
select pg_temp.access_assert((select count(*)=0 from public.equipment),'closing the appointment immediately removes coordinator scope');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.user_role_assignments set is_active=false where profile_id='da230000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','da230000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.access_assert((select count(*)=0 from public.equipment) and (select count(*)=0 from public.clients),'revoking a role immediately removes its visibility');
reset role;
select 'PASS: fresh QSHE, coordinator, HRGA, personnel, AM and PTK accounts inherit scoped data; branch and write boundaries preserved; revocation immediate' result;
rollback;
