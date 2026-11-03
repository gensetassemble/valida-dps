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
insert into auth.users(id,email) select ('af100000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'workflow.'||i||'@example.invalid' from generate_series(1,9)i;
insert into public.employee_directory(id,branch_code,full_name,npp,employment_status,verification_status,is_active)
select ('af200000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=7 then 'WFQ' else 'DPS' end,'[CONTOH] Workflow Person '||i,case when i=1 then null when i=2 then '03702' else (93700+i)::text end,case when i=5 then 'unknown' else 'active' end,'verified',true from generate_series(1,9)i;
insert into public.profiles(id,employee_id,branch_code,full_name,is_active)
select ('af100000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('af200000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=7 then 'WFQ' else 'DPS' end,'[CONTOH] Workflow Account '||i,true from generate_series(1,9)i;
-- Employee activation/verification is not a login gate; the account and role are.
update public.employee_directory set is_active=false,verification_status='pending' where id='af200000-0000-4000-8000-000000000005';
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason)
select ('af100000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=7 then 'WFQ' else 'DPS' end,(array['admin','coordinator','equipment_manager','hrga','inspector','branch_head','admin','department_head','unit_head'])[i],'[CONTOH] Transaction-only regression' from generate_series(1,9)i;
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
select pg_temp.expect_workflow_failure($q$insert into public.calibration_requests(branch_code,equipment_id,status,request_number,unit_name,notes) values('DPS','af400000-0000-4000-8000-000000000001','submitted','1001','DPS','[CONTOH] forbidden admin request')$q$,'admin without coordinator cannot submit');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000002',true);
select pg_temp.expect_workflow_failure($q$insert into public.calibration_requests(branch_code,equipment_id,status,request_number,unit_name,notes) values('DPS','af400000-0000-4000-8000-000000000002','submitted','1002','DPS','[CONTOH] outside scope')$q$,'coordinator portfolio isolation');
select pg_temp.expect_workflow_failure($q$insert into public.calibration_requests(branch_code,equipment_id,status,request_number,unit_name,notes,estimated_days) values('DPS','af400000-0000-4000-8000-000000000001','submitted','1003','DPS','[CONTOH] cannot fill estimates',2)$q$,'manual costs stay outside system');
insert into public.calibration_requests(id,branch_code,equipment_id,status,request_kind,request_number,unit_name,notes,requester_npp) values('af800000-0000-4000-8000-000000000001','DPS','af400000-0000-4000-8000-000000000001','submitted','repair','1004','DPS','[CONTOH] repair request','99999');
select pg_temp.assert_workflow((select status='submitted' and requester_npp='03702' and requester_name='[CONTOH] Workflow Person 2' and created_at=now() and not requester_signed and signed_document_id is null from public.calibration_requests where id='af800000-0000-4000-8000-000000000001'),'direct submission without signature gate, directory identity stamped');
select pg_temp.expect_workflow_failure($q$insert into public.calibration_requests(branch_code,equipment_id,status,request_number,unit_name,notes) values('DPS','af400000-0000-4000-8000-000000000001','submitted','1005','DPS','[CONTOH] duplicate request')$q$,'one active request');
select pg_temp.expect_workflow_failure($q$update public.calibration_requests set status='completed' where id='af800000-0000-4000-8000-000000000001'$q$,'coordinator cannot update PTK progress');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000003',true);
select pg_temp.assert_workflow(exists(select 1 from public.user_notifications where title='Permintaan alat: Sedang Diajukan'),'PTK receives submission notification');
select pg_temp.expect_workflow_failure($q$insert into public.calibration_requests(branch_code,equipment_id,status,request_number,unit_name,notes) values('DPS','af400000-0000-4000-8000-000000000003','submitted','1006','DPS','[CONTOH] PTK cannot apply')$q$,'PTK cannot submit');
select pg_temp.expect_workflow_failure($q$update public.calibration_requests set status='accepted',estimated_cost=30 where id='af800000-0000-4000-8000-000000000001'$q$,'PTK cannot track manual Excel costs');
update public.calibration_requests set status='accepted' where id='af800000-0000-4000-8000-000000000001';
select pg_temp.assert_workflow((select version=2 from public.calibration_requests where id='af800000-0000-4000-8000-000000000001'),'PTK progress versioned');
update public.calibration_requests set status='completed' where id='af800000-0000-4000-8000-000000000001';
select pg_temp.assert_workflow((select calibration_id is null and estimated_days is null and estimated_cost is null from public.calibration_requests where id='af800000-0000-4000-8000-000000000001'),'completion tracks progress only');
select pg_temp.assert_workflow(not exists(select 1 from public.calibrations where equipment_id='af400000-0000-4000-8000-000000000001'),'completion does not fabricate calibration result');
select pg_temp.expect_workflow_failure($q$update public.calibration_requests set status='accepted' where id='af800000-0000-4000-8000-000000000001'$q$,'closed history immutable');
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
select pg_temp.assert_workflow((select count(*)=3 from public.calibration_request_events where request_id='af800000-0000-4000-8000-000000000001'),'request history preserved');
select pg_temp.assert_workflow(not exists(select profile_id,event_id from public.user_notifications group by profile_id,event_id having count(*)>1),'notification deduplication');
-- Cleanup is explicit and role-scoped; test fixtures roll back with the suite.
reset role;
select set_config('request.jwt.claim.sub','',true);
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason) values('af100000-0000-4000-8000-000000000001','DPS','super_admin','[CONTOH] cleanup test');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000002',true);
set local role authenticated;
insert into public.calibration_requests(id,branch_code,equipment_id,status,request_number,unit_name,notes) values('af800000-0000-4000-8000-000000000002','DPS','af400000-0000-4000-8000-000000000001','submitted','1007','DPS','[CONTOH] cleanup request');
select pg_temp.expect_workflow_failure($q$select public.manage_equipment_request('af800000-0000-4000-8000-000000000002',null,'cancel')$q$,'null version rejected');
select pg_temp.expect_workflow_failure($q$select public.manage_equipment_request('af800000-0000-4000-8000-000000000002',99,'cancel')$q$,'stale version rejected');
select public.manage_equipment_request('af800000-0000-4000-8000-000000000002',1,'cancel');
select pg_temp.assert_workflow((select status='cancelled' and version=2 from public.calibration_requests where id='af800000-0000-4000-8000-000000000002'),'creator coordinator cancels');
select pg_temp.assert_workflow(exists(select 1 from public.notification_inbox_records n join public.calibration_request_events e on e.id=n.event_id where e.request_id='af800000-0000-4000-8000-000000000002'),'ordinary cancellation remains visible before history cleanup');
select pg_temp.expect_workflow_failure($q$select public.manage_equipment_request('af800000-0000-4000-8000-000000000002',2,'delete_history')$q$,'coordinator cannot delete history');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000003',true);
select pg_temp.expect_workflow_failure($q$select public.manage_equipment_request('af800000-0000-4000-8000-000000000002',2,'delete_history')$q$,'PTK cannot delete history');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000007',true);
select pg_temp.expect_workflow_failure($q$select public.manage_equipment_request('af800000-0000-4000-8000-000000000002',2,'delete_history')$q$,'other branch cannot delete history');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000001',true);
select public.manage_equipment_request('af800000-0000-4000-8000-000000000002',2,'delete_history');
select pg_temp.assert_workflow(not exists(select 1 from public.calibration_requests where id='af800000-0000-4000-8000-000000000002'),'deleted history hidden by RLS');
select pg_temp.expect_workflow_failure($q$select public.manage_equipment_request('af800000-0000-4000-8000-000000000002',3,'cancel')$q$,'deleted request cannot be changed');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000002',true);
insert into public.calibration_requests(id,branch_code,equipment_id,status,request_number,unit_name,notes) values('af800000-0000-4000-8000-000000000003','DPS','af400000-0000-4000-8000-000000000001','submitted','1008','DPS','[CONTOH] reapply after cancel');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000001',true);
select pg_temp.expect_workflow_failure($q$select public.manage_equipment_request('af800000-0000-4000-8000-000000000003',1,'delete_history')$q$,'active request must be cancelled first');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000004',true);
select pg_temp.expect_workflow_failure($q$select public.manage_equipment_request('af800000-0000-4000-8000-000000000003',1,'cancel')$q$,'HRGA cannot cancel equipment request');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000003',true);
select public.manage_equipment_request('af800000-0000-4000-8000-000000000003',1,'cancel');
reset role;
select pg_temp.assert_workflow((select history_deleted_at is not null and history_deleted_by='af100000-0000-4000-8000-000000000001' from public.calibration_requests where id='af800000-0000-4000-8000-000000000002'),'deletion attribution retained');
select pg_temp.assert_workflow((select count(*)=2 from public.calibration_request_events where request_id='af800000-0000-4000-8000-000000000002'),'events preserved after history deletion');
select pg_temp.assert_workflow(exists(select 1 from public.equipment where id='af400000-0000-4000-8000-000000000001'),'cleanup preserves equipment');
-- Replacement certificates update current monitoring and notification context automatically.
select pg_temp.assert_workflow((select superseded_by_certificate_id='af600000-0000-4000-8000-000000000002' from public.personnel_certificate_portfolios where id='af600000-0000-4000-8000-000000000001'),'old certificate retained as replaced history');
select pg_temp.assert_workflow((select previous_certificate_id='af600000-0000-4000-8000-000000000001' and renewal_status='renewed' from public.personnel_certificate_portfolios where id='af600000-0000-4000-8000-000000000002'),'new certificate inherits completed renewal');
select pg_temp.assert_workflow(not exists(select 1 from public.operational_scope_records where domain='personnel' and id='af600000-0000-4000-8000-000000000001'),'dashboard excludes replaced version');
select pg_temp.assert_workflow(exists(select 1 from public.operational_scope_records where domain='personnel' and id='af600000-0000-4000-8000-000000000002'),'dashboard uses replacement');
select pg_temp.assert_workflow(exists(select 1 from public.user_notification_details where display_title like '%Workflow Person 5%' and display_title like '%[CONTOH] OLD%' and replacement_certificate_number='[CONTOH] NEW' and display_href like '%af600000-0000-4000-8000-000000000002%'),'existing notifications identify employee/license/certificate and link replacement');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000007',true);
set local role authenticated;
select pg_temp.assert_workflow(not exists(select 1 from public.user_notification_details where branch_code='DPS'),'notification detail preserves recipient isolation');
reset role;
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000002',true);
set local role authenticated;
insert into public.equipment(id,branch_code,portfolio_id,name) values('af400000-0000-4000-8000-000000000004','DPS','af300000-0000-4000-8000-000000000001','[CONTOH] Coordinator added asset');
update public.equipment set name='[CONTOH] Coordinator updated asset' where id='af400000-0000-4000-8000-000000000004';
select pg_temp.assert_workflow((select name='[CONTOH] Coordinator updated asset' from public.equipment where id='af400000-0000-4000-8000-000000000004'),'coordinator can add and edit assigned internal equipment');
insert into public.calibrations(equipment_id,branch_code,calibration_date,due_date) values('af400000-0000-4000-8000-000000000004','DPS','2026-01-01','2027-01-01');
select pg_temp.assert_workflow(exists(select 1 from public.calibrations where equipment_id='af400000-0000-4000-8000-000000000004'),'coordinator can record initial calibration within portfolio');
select pg_temp.expect_workflow_failure($q$insert into public.equipment(branch_code,portfolio_id,name) values('DPS','af300000-0000-4000-8000-000000000002','[CONTOH] Outside portfolio')$q$,'coordinator cannot create outside assigned portfolio');
select pg_temp.expect_workflow_failure($q$update public.equipment set portfolio_id='af300000-0000-4000-8000-000000000002' where id='af400000-0000-4000-8000-000000000004'$q$,'coordinator cannot move equipment to another portfolio');
select pg_temp.expect_workflow_failure($q$update public.equipment set ownership='client' where id='af400000-0000-4000-8000-000000000004'$q$,'coordinator internal equipment only');
select pg_temp.expect_workflow_failure($q$update public.calibration_requests set status='completed' where id='af800000-0000-4000-8000-000000000003'$q$,'coordinator still cannot update PTK progress');
reset role;

-- Renewal cleanup preserves certificates and completed generation links.
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000004',true);
set local role authenticated;
select pg_temp.expect_workflow_failure($q$select public.manage_personnel_renewal('af900000-0000-4000-8000-000000000001','DPS',1,'delete_history','[CONTOH] stale request')$q$,'stale version rejected');
insert into public.personnel_renewal_cases(id,certificate_id,branch_code,status,notes) values('af900000-0000-4000-8000-000000000007','af600000-0000-4000-8000-000000000002','DPS','unprocessed','[CONTOH] New cycle after previous renewal');
select public.manage_personnel_renewal('af900000-0000-4000-8000-000000000007','DPS',1,'cancel','[CONTOH] Stop new testing cycle');
select public.manage_personnel_renewal('af900000-0000-4000-8000-000000000007','DPS',2,'delete_history','[CONTOH] Hide new testing cycle');
select pg_temp.assert_workflow((select renewal_status='unprocessed' from public.personnel_certificate_portfolios where id='af600000-0000-4000-8000-000000000002'),'stopped cycle does not inherit older completed status');
select public.manage_personnel_renewal('af900000-0000-4000-8000-000000000001','DPS',(select version from public.personnel_renewal_cases where id='af900000-0000-4000-8000-000000000001'),'delete_history','[CONTOH] completed history cleanup');
select pg_temp.assert_workflow((select superseded_by_certificate_id is null and renewal_status='unprocessed' and certificate_number='[CONTOH] OLD' and issue_date='2024-01-01' and expiry_date='2025-01-01' from public.personnel_certificate_portfolios where id='af600000-0000-4000-8000-000000000001'),'reset restores original certificate number, issue date and expiry');
select pg_temp.assert_workflow(not exists(select 1 from public.personnel_certificate_portfolios where id='af600000-0000-4000-8000-000000000002'),'test replacement removed from monitoring');
select pg_temp.assert_workflow((select replacement_certificate_id='af600000-0000-4000-8000-000000000002' from public.personnel_renewal_cases where id='af900000-0000-4000-8000-000000000001'),'reset preserves underlying audit lineage');
select pg_temp.expect_workflow_failure($q$insert into public.personnel_renewal_cases(certificate_id,branch_code,notes) values('af600000-0000-4000-8000-000000000002','DPS','[CONTOH] invalid restart on reset copy')$q$,'reset replacement cannot start a new cycle');
insert into public.personnel_renewal_cases(id,certificate_id,branch_code,status,notes) values('af900000-0000-4000-8000-000000000008','af600000-0000-4000-8000-000000000001','DPS','unprocessed','[CONTOH] Cancellation QA');
select pg_temp.expect_workflow_failure($q$select public.manage_personnel_renewal('af900000-0000-4000-8000-000000000008','DPS',1,'delete_history','[CONTOH] active history protected')$q$,'cannot hide active process');
select public.manage_personnel_renewal('af900000-0000-4000-8000-000000000008','DPS',1,'cancel','[CONTOH] Cancel testing process');
select pg_temp.assert_workflow((select status='cancelled' and version=2 from public.personnel_renewal_cases where id='af900000-0000-4000-8000-000000000008'),'HRGA cancels active process');
select public.manage_personnel_renewal('af900000-0000-4000-8000-000000000008','DPS',2,'delete_history','[CONTOH] Hide testing process');
insert into public.personnel_renewal_cases(id,certificate_id,branch_code,status,notes) values('af900000-0000-4000-8000-000000000009','af600000-0000-4000-8000-000000000001','DPS','unprocessed','[CONTOH] Reopened after cancellation');
select pg_temp.assert_workflow((select count(*)=1 from public.personnel_certificate_portfolios where id='af600000-0000-4000-8000-000000000001'),'cancelled and restarted process does not duplicate certificate rows');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000002',true);
select pg_temp.expect_workflow_failure($q$select public.manage_personnel_renewal('af900000-0000-4000-8000-000000000009','DPS',1,'cancel','[CONTOH] coordinator forbidden')$q$,'coordinator cannot cancel HRGA process');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000007',true);
select pg_temp.expect_workflow_failure($q$select public.manage_personnel_renewal('af900000-0000-4000-8000-000000000009','DPS',1,'cancel','[CONTOH] wrong branch forbidden')$q$,'cross branch cleanup denied');
reset role;

-- Archival removes only the exact deleted process from inboxes, never event/audit data.
select pg_temp.assert_workflow(exists(select 1 from public.user_notifications n join public.calibration_request_events e on e.id=n.event_id where e.request_id='af800000-0000-4000-8000-000000000002') and not exists(select 1 from public.user_notifications n join public.calibration_request_events e on e.id=n.event_id where e.request_id='af800000-0000-4000-8000-000000000002' and n.archived_at is null),'all equipment request recipients archived without deleting records');
select pg_temp.assert_workflow(not exists(select 1 from public.notification_inbox_records n join public.calibration_request_events e on e.id=n.event_id where e.request_id='af800000-0000-4000-8000-000000000002'),'deleted equipment request absent from inbox projection');
select pg_temp.assert_workflow(exists(select 1 from public.user_notifications n join public.personnel_renewal_events e on e.id=n.event_id where e.case_id='af900000-0000-4000-8000-000000000001') and not exists(select 1 from public.user_notifications n join public.personnel_renewal_events e on e.id=n.event_id where e.case_id='af900000-0000-4000-8000-000000000001' and n.archived_at is null),'completed renewal reset archives all recipients');
select pg_temp.assert_workflow(exists(select 1 from public.user_notifications n join public.personnel_renewal_events e on e.id=n.event_id where e.case_id='af900000-0000-4000-8000-000000000009' and n.archived_at is null),'new process for same certificate stays in inbox');
select pg_temp.assert_workflow(exists(select 1 from public.user_notifications n join public.calibration_request_events e on e.id=n.event_id where e.request_id='af800000-0000-4000-8000-000000000003' and n.archived_at is null),'another cancelled process on same equipment stays in inbox');
select pg_temp.assert_workflow(exists(select 1 from public.user_notifications where archived_at is not null and read_at is null),'archive does not pretend unread entries were read');
select pg_temp.assert_workflow(not has_column_privilege('authenticated','public.user_notifications','archived_at','UPDATE') and not has_function_privilege('authenticated','private.archive_workflow_notifications()','EXECUTE'),'clients cannot forge archival or call internal archive trigger');
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000003',true);
set local role authenticated;
select pg_temp.assert_workflow((select count(*) from public.user_notifications where archived_at is null and read_at is null)=(select count(*) from public.notification_inbox_records where read_at is null),'sidebar unread count equals active inbox for PTK');
reset role;

select pass('Coordinator submission, PTK progress, scope, independent calibration, HRGA evidence, immutable history and inbox isolation');
select * from finish();
rollback;
