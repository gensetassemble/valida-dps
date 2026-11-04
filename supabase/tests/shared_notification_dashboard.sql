begin;
-- Positive privileged fixtures represent a completed MFA verification.
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
create function pg_temp.assert_workflow(v boolean,msg text) returns void language plpgsql as $$begin if v is distinct from true then raise exception 'Workflow assertion: %',msg;end if;end $$;
create function pg_temp.expect_workflow_failure(statement text,msg text) returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'Expected denial: %',msg;end $$;
-- All fixtures and storage metadata are rolled back. No email is sent.
insert into public.branches(code,name) values('WFQ','[CONTOH] Workflow QA');
insert into public.portfolios(id,branch_code,code,name) values
 ('af300000-0000-4000-8000-000000000001','DPS','CONTOH_WF1','[CONTOH] Workflow 1'),
 ('af300000-0000-4000-8000-000000000002','DPS','CONTOH_WF2','[CONTOH] Workflow 2'),
 ('af300000-0000-4000-8000-000000000003','WFQ','CONTOH_WF3','[CONTOH] Other branch');
insert into auth.users(id,email) select ('af100000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'workflow.'||i||'@example.invalid' from generate_series(1,9)i;
insert into public.employee_directory(id,branch_code,full_name,npp,employment_status,verification_status,is_active)
select ('af200000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=7 then 'WFQ' else 'DPS' end,'[CONTOH] Workflow Person '||i,case when i=1 then null when i=2 then '03702' else (93700+i)::text end,case when i=5 then 'unknown' else 'active' end,'verified',true from generate_series(1,9)i;
insert into public.profiles(id,employee_id,branch_code,full_name,is_active)
select ('af100000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('af200000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=7 then 'WFQ' else 'DPS' end,'[CONTOH] Workflow Account '||i,true from generate_series(1,9)i;
-- Employee activation/verification is not a login gate; the account and role are.
update public.employee_directory set is_active=false,verification_status='pending' where id='af200000-0000-4000-8000-000000000005';
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason)
select ('af100000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=7 then 'WFQ' else 'DPS' end,(array['super_admin','coordinator','equipment_manager','hrga','inspector','branch_head','super_admin','department_head','unit_head'])[i],'[CONTOH] Transaction-only regression' from generate_series(1,9)i;
insert into public.employee_portfolio_assignments(employee_id,portfolio_id,branch_code,assignment_type,effective_from,verification_status,is_active) values
 ('af200000-0000-4000-8000-000000000002','af300000-0000-4000-8000-000000000001','DPS','coordinator','2020-01-01','verified',true),
 ('af200000-0000-4000-8000-000000000003','af300000-0000-4000-8000-000000000001','DPS','equipment_responsible','2020-01-01','verified',true),
 ('af200000-0000-4000-8000-000000000005','af300000-0000-4000-8000-000000000001','DPS','personnel','2020-01-01','verified',true);
insert into public.equipment(id,branch_code,portfolio_id,name) values
 ('af400000-0000-4000-8000-000000000001','DPS','af300000-0000-4000-8000-000000000001','[CONTOH] Test Equipment'),
 ('af400000-0000-4000-8000-000000000002','DPS','af300000-0000-4000-8000-000000000002','[CONTOH] Outside Scope');
insert into public.certificate_types(id,branch_code,code,name,category) values('af500000-0000-4000-8000-000000000001','DPS','CONTOH_WF','[CONTOH] Test License','personnel');
insert into public.personnel_certificates(id,branch_code,employee_id,certificate_type_id,certificate_number,original_title,issue_date,expiry_date,validity_kind) values
 ('af600000-0000-4000-8000-000000000001','DPS','af200000-0000-4000-8000-000000000005','af500000-0000-4000-8000-000000000001','[CONTOH] OLD','[CONTOH] Old certificate','2024-01-01','2025-01-01','term'),
 ('af600000-0000-4000-8000-000000000002','DPS','af200000-0000-4000-8000-000000000005','af500000-0000-4000-8000-000000000001','[CONTOH] NEW','[CONTOH] Replacement','2026-01-01','2027-01-01','term'),
 ('af600000-0000-4000-8000-000000000003','DPS','af200000-0000-4000-8000-000000000005','af500000-0000-4000-8000-000000000001','[CONTOH] LIFE','[CONTOH] Lifetime','2024-01-01',null,'lifetime');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000001',true);
set local role authenticated;
insert into public.operational_coordinators(id,branch_code,full_name) values('af700000-0000-4000-8000-000000000001','DPS','[CONTOH] Workflow Coordinator');
insert into public.portfolio_coordinators(id,branch_code,portfolio_id,coordinator_id,employee_id,effective_from) values('af710000-0000-4000-8000-000000000001','DPS','af300000-0000-4000-8000-000000000001','af700000-0000-4000-8000-000000000001','af200000-0000-4000-8000-000000000002','2020-01-01');

reset role;
select set_config('request.jwt.claim.sub','',true);
update public.employee_directory set full_name='Taufik Talentino' where id='af200000-0000-4000-8000-000000000008';
insert into public.equipment(id,branch_code,portfolio_id,name) values('af400000-0000-4000-8000-000000000003','DPS','af300000-0000-4000-8000-000000000001','[CONTOH] Second bundled tool');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.assert_workflow((select count(*)=1 from public.calibration_request_supervisors('DPS') where id='af100000-0000-4000-8000-000000000008'),'allowed named active fixture head');
select pg_temp.assert_workflow(not exists(select 1 from public.calibration_request_supervisors('DPS') where lower(full_name) not in ('taufik talentino','fikri haykal','putu angga bujana')),'nonapproved heads excluded');
select pg_temp.expect_workflow_failure($q$insert into public.calibration_requests(branch_code,equipment_id,equipment_ids,status,request_number,notes) values('DPS','af400000-0000-4000-8000-000000000001',array['af400000-0000-4000-8000-000000000001','af400000-0000-4000-8000-000000000002']::uuid[],'submitted','21','[CONTOH] mixed portfolio forbidden')$q$,'cannot bundle across portfolios');
select pg_temp.expect_workflow_failure($q$insert into public.calibration_requests(branch_code,equipment_id,status,request_number,notes,supervisor_profile_id) values('DPS','af400000-0000-4000-8000-000000000001','submitted','21','[CONTOH] disallowed head','af100000-0000-4000-8000-000000000009')$q$,'forged nonapproved unit head blocked');
select pg_temp.expect_workflow_failure($q$insert into public.calibration_requests(branch_code,equipment_id,equipment_ids,status,request_number,notes) values('DPS','af400000-0000-4000-8000-000000000001',array['af400000-0000-4000-8000-000000000001','af400000-0000-4000-8000-000000000001']::uuid[],'submitted','21','[CONTOH] duplicate members forbidden')$q$,'duplicate member blocked');
insert into public.calibration_requests(id,branch_code,equipment_id,equipment_ids,status,request_number,notes,supervisor_profile_id,signature_place,item_details,items_snapshot,quantity)
values('af800000-0000-4000-8000-000000000001','DPS','af400000-0000-4000-8000-000000000001',array['af400000-0000-4000-8000-000000000001','af400000-0000-4000-8000-000000000003']::uuid[],'submitted','21','[CONTOH] bundle request','af100000-0000-4000-8000-000000000008','Mataram','{"af400000-0000-4000-8000-000000000001":{"resolution_class":"1 mm","instrument_reading":"0\n100\n200"}}','[{"name":"forged"}]',999);
select pg_temp.assert_workflow((select quantity=2 and cardinality(equipment_ids)=2 and jsonb_array_length(items_snapshot)=2 and items_snapshot->0->>'name'<>'forged' and portfolio_code_snapshot='CONTOH_WF1' and unit_name='Cab Denpasar / CONTOH_WF1' and supervisor_title='Kepala Bidang Inspeksi dan Pengujian' and requester_npp='03702' and request_number like '0021/DPS-%/OPS-CONTOH_WF1/%' from public.calibration_requests where id='af800000-0000-4000-8000-000000000001'),'server stamps canonical header, identity and both item snapshots');
select pg_temp.expect_workflow_failure($q$insert into public.calibration_requests(branch_code,equipment_id,status,request_number,notes) values('DPS','af400000-0000-4000-8000-000000000003','submitted','22','[CONTOH] cannot request nonprimary member twice')$q$,'overlap blocked for nonprimary bundle member');
select pg_temp.expect_workflow_failure($q$update public.calibration_requests set status='accepted' where id='af800000-0000-4000-8000-000000000001'$q$,'coordinator cannot progress bundle');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000003',true);
update public.user_notifications set read_at=now() where event_id in (select id from public.calibration_request_events where request_id='af800000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000002',true);
select public.manage_equipment_request('af800000-0000-4000-8000-000000000001',1,'cancel');
select pg_temp.assert_workflow(exists(select 1 from public.notification_inbox_records where current_status='cancelled' and activity_group_id='calibrations:af800000-0000-4000-8000-000000000001'),'coordinator sees shared cancellation');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000003',true);
select pg_temp.assert_workflow(exists(select 1 from public.notification_inbox_records where event_status='submitted' and current_status='cancelled' and read_at is not null and activity_group_id='calibrations:af800000-0000-4000-8000-000000000001'),'PTK old read delivery resolves to cancellation without rewriting history');
select pg_temp.assert_workflow(exists(select 1 from public.notification_inbox_records where event_status='cancelled' and current_status='cancelled' and read_at is null and activity_group_id='calibrations:af800000-0000-4000-8000-000000000001'),'PTK receives unread cancellation');
select pg_temp.assert_workflow(not exists(select 1 from public.notification_inbox_records where profile_id<>auth.uid()),'other recipients remain private');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000001',true);
select pg_temp.assert_workflow((select count(*)=2 from public.notification_inbox_records where activity_group_id='calibrations:af800000-0000-4000-8000-000000000001' and current_status='cancelled' and read_at is null),'Super Admin receives submission and cancellation with current shared status');
update public.user_notifications set read_at=now() where profile_id=auth.uid() and event_id in (select id from public.calibration_request_events where request_id='af800000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000003',true);
select pg_temp.assert_workflow(exists(select 1 from public.notification_inbox_records where event_status='cancelled' and read_at is null and activity_group_id='calibrations:af800000-0000-4000-8000-000000000001'),'Super Admin read state does not mark PTK inbox read');
insert into public.calibrations(equipment_id,branch_code,calibration_date,due_date) values
 ('af400000-0000-4000-8000-000000000001','DPS',(now() at time zone 'Asia/Makassar')::date-366,(now() at time zone 'Asia/Makassar')::date-1),
 ('af400000-0000-4000-8000-000000000003','DPS',(now() at time zone 'Asia/Makassar')::date-100,(now() at time zone 'Asia/Makassar')::date+10);
select pg_temp.assert_workflow(exists(select 1 from jsonb_array_elements(public.operational_summary('DPS','{"category":"calibrations"}')->'soon') v where v->>'id'='af400000-0000-4000-8000-000000000001' and v->>'validity_status'='Expired'),'dashboard includes expired equipment');
select pg_temp.assert_workflow(exists(select 1 from jsonb_array_elements(public.operational_summary('DPS','{"category":"calibrations"}')->'soon') v where v->>'id'='af400000-0000-4000-8000-000000000003'),'dashboard keeps upcoming equipment');
select pg_temp.assert_workflow(not exists(select 1 from jsonb_array_elements(public.operational_summary('DPS','{"category":"calibrations"}')->'soon') v where v->>'domain'<>'calibrations'),'category remains filtered');
select pg_temp.assert_workflow(jsonb_array_length(public.operational_summary('DPS','{"category":"personnel"}')->'soon')=0,'PTK cannot expand into personnel data');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000007',true);
select pg_temp.assert_workflow(not exists(select 1 from public.notification_inbox_records where branch_code='DPS'),'other branch has no access to status projection');
reset role;
select pg_temp.assert_workflow((select count(*)=2 from public.calibration_request_events where request_id='af800000-0000-4000-8000-000000000001'),'events unchanged by live status projection');
select set_config('request.jwt.claim.sub','',true);
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason)
 values('af100000-0000-4000-8000-000000000006','DPS','super_admin','[CONTOH] Newly assigned administrator');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000006',true);
set local role authenticated;
select pg_temp.assert_workflow((select count(*)=1 from public.notification_inbox_records where current_status='cancelled' and read_at is null and activity_group_id='calibrations:af800000-0000-4000-8000-000000000001'),'new Super Admin receives latest retained cancellation');
update public.user_notifications set read_at=now() where profile_id=auth.uid();
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.user_role_assignments set grant_reason='[CONTOH] Idempotent role update' where profile_id='af100000-0000-4000-8000-000000000006' and role_code='super_admin';
select pg_temp.assert_workflow((select count(*)=1 and bool_and(read_at is not null) from public.user_notifications where profile_id='af100000-0000-4000-8000-000000000006'),'backfill preserves read state and creates no duplicates');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.manage_equipment_request('af800000-0000-4000-8000-000000000001',2,'delete_history');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.user_role_assignments set grant_reason='[CONTOH] No archived history resurrection' where profile_id='af100000-0000-4000-8000-000000000006' and role_code='super_admin';
select pg_temp.assert_workflow(not exists(select 1 from public.user_notifications where profile_id='af100000-0000-4000-8000-000000000006' and archived_at is null),'deleted history stays archived after another role update');
select pass('Shared cancellation delivery, original event history, unread PTK notice, expired/upcoming priorities and role isolation');
select * from finish();
rollback;
