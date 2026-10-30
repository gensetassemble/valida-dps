begin;
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
insert into auth.users(id,email) select ('af100000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'workflow.'||i||'@example.invalid' from generate_series(1,7)i;
insert into public.employee_directory(id,branch_code,full_name,npp,employment_status,verification_status,is_active)
select ('af200000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=7 then 'WFQ' else 'DPS' end,'[CONTOH] Workflow Person '||i,(93700+i)::text,case when i=5 then 'unknown' else 'active' end,'verified',true from generate_series(1,7)i;
insert into public.profiles(id,employee_id,branch_code,full_name,is_active)
select ('af100000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('af200000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=7 then 'WFQ' else 'DPS' end,'[CONTOH] Workflow Account '||i,true from generate_series(1,7)i;
-- Employee activation/verification is not a login gate; the account and role are.
update public.employee_directory set is_active=false,verification_status='pending' where id='af200000-0000-4000-8000-000000000005';
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason)
select ('af100000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=7 then 'WFQ' else 'DPS' end,(array['admin','coordinator','equipment_manager','hrga','inspector','branch_head','admin'])[i],'[CONTOH] Transaction-only regression' from generate_series(1,7)i;
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
select pg_temp.expect_workflow_failure($q$insert into public.portfolio_coordinators(branch_code,portfolio_id,coordinator_id,effective_from) values('DPS','af300000-0000-4000-8000-000000000001','af700000-0000-4000-8000-000000000001','2024-01-01')$q$,'overlap');
insert into public.equipment(id,branch_code,portfolio_id,name) values('af400000-0000-4000-8000-000000000003','DPS','af300000-0000-4000-8000-000000000001','[CONTOH] Automatic Responsible');
select pg_temp.assert_workflow((select responsible_employee_id='af200000-0000-4000-8000-000000000002' from public.equipment where id='af400000-0000-4000-8000-000000000003'),'auto coordinator');
select pg_temp.assert_workflow((select responsible_employee_id is null from public.equipment where id='af400000-0000-4000-8000-000000000001'),'old responsibility untouched');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000002',true);
select pg_temp.expect_workflow_failure($q$insert into public.equipment(branch_code,portfolio_id,name) values('DPS','af300000-0000-4000-8000-000000000001','[CONTOH] forbidden coordinator asset write')$q$,'coordinator not equipment editor');
select pg_temp.expect_workflow_failure($q$insert into public.calibration_requests(branch_code,equipment_id,notes) values('DPS','af400000-0000-4000-8000-000000000002','[CONTOH] denied request')$q$,'unauthorized portfolio');
insert into public.calibration_requests(id,branch_code,equipment_id,notes,request_number,requester_name,supervisor_name) values('af800000-0000-4000-8000-000000000001','DPS','af400000-0000-4000-8000-000000000001','[CONTOH] calibration request','[CONTOH] WF-197','[CONTOH] Requester','[CONTOH] Supervisor');
select pg_temp.expect_workflow_failure($q$insert into public.calibration_requests(branch_code,equipment_id,notes) values('DPS','af400000-0000-4000-8000-000000000001','[CONTOH] duplicate active')$q$,'duplicate active');
select pg_temp.expect_workflow_failure($q$update public.calibration_requests set status='submitted' where id='af800000-0000-4000-8000-000000000001'$q$,'cannot skip signatures');
update public.calibration_requests set status='awaiting_signatures' where id='af800000-0000-4000-8000-000000000001';
select pg_temp.expect_workflow_failure($q$update public.calibration_requests set status='submitted',requester_signed=true,supervisor_signed=true where id='af800000-0000-4000-8000-000000000001'$q$,'no stored PDF');
insert into public.workflow_documents(id,branch_code,request_id,object_path,original_name,file_bytes) values('af810000-0000-4000-8000-000000000001','DPS','af800000-0000-4000-8000-000000000001','DPS/af800000-0000-4000-8000-000000000001/af810000-0000-4000-8000-000000000001.pdf','[CONTOH] signed.pdf',30);
insert into storage.objects(bucket_id,name) values('workflow-documents','DPS/af800000-0000-4000-8000-000000000001/af810000-0000-4000-8000-000000000001.pdf');
update public.calibration_requests set status='submitted',signed_document_id='af810000-0000-4000-8000-000000000001',requester_signed=true,supervisor_signed=true where id='af800000-0000-4000-8000-000000000001';
select pg_temp.expect_workflow_failure($q$update public.calibration_requests set status='accepted' where id='af800000-0000-4000-8000-000000000001'$q$,'coordinator cannot act as PTK');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000003',true);
select pg_temp.assert_workflow(exists(select 1 from public.user_notifications where title like '%Diajukan ke PTK%'),'PTK notification');
select pg_temp.expect_workflow_failure($q$update public.calibration_requests set status='accepted',requester_name='tampered' where id='af800000-0000-4000-8000-000000000001'$q$,'PTK cannot rewrite signed fields');
update public.calibration_requests set status='accepted',notes='[CONTOH] Signed PDF reviewed' where id='af800000-0000-4000-8000-000000000001';
select pg_temp.expect_workflow_failure($q$update public.calibration_requests set status='completed' where id='af800000-0000-4000-8000-000000000001'$q$,'completion needs calibration');
insert into public.calibrations(id,branch_code,equipment_id,calibration_date,due_date,certificate_number,result) values('af820000-0000-4000-8000-000000000001','DPS','af400000-0000-4000-8000-000000000001','2026-10-30','2027-10-30','[CONTOH] CAL-NEW','layak');
update public.calibration_requests set status='completed',calibration_id='af820000-0000-4000-8000-000000000001',notes='[CONTOH] Calibration result complete' where id='af800000-0000-4000-8000-000000000001';
select pg_temp.expect_workflow_failure($q$update public.calibration_requests set status='draft' where id='af800000-0000-4000-8000-000000000001'$q$,'closed history immutable');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000004',true);
insert into public.personnel_certificates(id,branch_code,employee_id,certificate_type_id,certificate_number,original_title,issue_date,expiry_date) values('af600000-0000-4000-8000-000000000004','DPS','af200000-0000-4000-8000-000000000002','af500000-0000-4000-8000-000000000001','[CONTOH] COORDINATOR','[CONTOH] Coordinator own certificate','2024-01-01','2025-01-01');
insert into public.personnel_renewal_cases(id,branch_code,certificate_id,notes) values('af900000-0000-4000-8000-000000000002','DPS','af600000-0000-4000-8000-000000000004','[CONTOH] Owner is also coordinator');
select pg_temp.assert_workflow((select holder_delivery_available from public.personnel_renewal_events where case_id='af900000-0000-4000-8000-000000000002'),'coordinator certificate holder delivery is recognized');
select pg_temp.expect_workflow_failure($q$insert into public.personnel_renewal_cases(branch_code,certificate_id,notes) values('DPS','af600000-0000-4000-8000-000000000003','[CONTOH] lifetime renewal')$q$,'lifetime excluded');
insert into public.personnel_renewal_cases(id,branch_code,certificate_id,notes) values('af900000-0000-4000-8000-000000000001','DPS','af600000-0000-4000-8000-000000000001','[CONTOH] HRGA starts renewal');
select pg_temp.expect_workflow_failure($q$update public.personnel_renewal_cases set status='renewed',replacement_certificate_id='af600000-0000-4000-8000-000000000002' where id='af900000-0000-4000-8000-000000000001'$q$,'no skipping HRGA gate');
update public.personnel_renewal_cases set status='processing',notes='[CONTOH] Waiting for new certificate' where id='af900000-0000-4000-8000-000000000001';
select pg_temp.expect_workflow_failure($q$update public.personnel_renewal_cases set status='renewed',replacement_certificate_id='af600000-0000-4000-8000-000000000002' where id='af900000-0000-4000-8000-000000000001'$q$,'replacement needs evidence');
update public.personnel_certificates set source_folder_url='https://drive.google.com/drive/folders/CONTOH-WORKFLOW',source_provider='google_drive_folder' where id='af600000-0000-4000-8000-000000000002';
update public.personnel_renewal_cases set status='renewed',replacement_certificate_id='af600000-0000-4000-8000-000000000002',notes='[CONTOH] Replacement and evidence checked' where id='af900000-0000-4000-8000-000000000001';
select pg_temp.assert_workflow((select expiry_date='2025-01-01' from public.personnel_certificates where id='af600000-0000-4000-8000-000000000001'),'old expiry unchanged');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000005',true);
select pg_temp.assert_workflow(private.actor_enabled(),'active account does not require employee activation');
select pg_temp.assert_workflow((select status='renewed' from public.personnel_renewal_cases where id='af900000-0000-4000-8000-000000000001'),'holder own status');
select pg_temp.assert_workflow((select count(*)=3 from public.user_notifications where profile_id=auth.uid()),'holder receives 3 status events');
select pg_temp.assert_workflow(not exists(select 1 from public.user_notifications where profile_id<>auth.uid()),'inbox isolation');
update public.user_notifications set read_at=now() where profile_id=auth.uid();
select pg_temp.assert_workflow(not exists(select 1 from public.user_notifications where read_at is null),'mark read');
update public.personnel_renewal_cases set notes='[CONTOH] holder cannot edit official process' where id='af900000-0000-4000-8000-000000000001';
select pg_temp.assert_workflow((select notes='[CONTOH] Replacement and evidence checked' from public.personnel_renewal_cases where id='af900000-0000-4000-8000-000000000001'),'holder RLS update affects zero rows');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000006',true);
select pg_temp.assert_workflow(exists(select 1 from public.calibration_requests where id='af800000-0000-4000-8000-000000000001'),'branch head can read');
select pg_temp.assert_workflow(not has_table_privilege('authenticated','public.calibration_request_events','UPDATE') and not has_table_privilege('authenticated','public.personnel_renewal_events','INSERT'),'history is trigger only');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000007',true);
select pg_temp.assert_workflow(not exists(select 1 from public.calibration_requests where branch_code='DPS'),'cross branch request isolation');
select pg_temp.assert_workflow(not exists(select 1 from public.personnel_renewal_cases where branch_code='DPS'),'cross branch HRGA isolation');
reset role;
select pg_temp.assert_workflow((select count(*)=5 from public.calibration_request_events where request_id='af800000-0000-4000-8000-000000000001'),'request history preserved');
select pg_temp.assert_workflow(not exists(select profile_id,event_id from public.user_notifications group by profile_id,event_id having count(*)>1),'notification deduplication');
select pass('Workflow gates, signatures, scope, calibration result, HRGA evidence, immutable history, responsibility and inbox isolation');
select * from finish();
rollback;
