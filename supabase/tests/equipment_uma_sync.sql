-- Run only against isolated development: synthetic records, transaction rollback.
begin;
create function pg_temp.uma_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'UMA test: %',message;end if;end$$;
create function pg_temp.uma_denied(q text) returns void language plpgsql as $$begin begin execute q;exception when others then return;end;raise exception 'Expected UMA rejection';end$$;
insert into public.branches(code,name) values('UMAQA','[UJI] UMA import rollback');
insert into auth.users(id) select ('e9120000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,4)i;
insert into public.employee_directory(id,branch_code,full_name,employment_status,verification_status,is_active)
select ('e9130000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'UMAQA','[UJI] UMA user '||i,'active','verified',true from generate_series(1,4)i;
insert into public.profiles(id,employee_id,branch_code,full_name,is_active)
select ('e9120000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('e9130000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'UMAQA','[UJI] UMA user '||i,true from generate_series(1,4)i;
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason)
select ('e9120000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'UMAQA',(array['super_admin','equipment_manager','coordinator','tester'])[i],'[UJI] Rollback import test' from generate_series(1,4)i;
insert into public.portfolios(id,branch_code,code,name) values('e9140000-0000-4000-8000-000000000001','UMAQA','PIK','PIK'),('e9140000-0000-4000-8000-000000000002','UMAQA','LAB','LAB');
insert into public.employee_portfolio_assignments(branch_code,employee_id,portfolio_id,assignment_type,verification_status,approved_at)
values('UMAQA','e9130000-0000-4000-8000-000000000002','e9140000-0000-4000-8000-000000000001','equipment_responsible','verified',now()),('UMAQA','e9130000-0000-4000-8000-000000000003','e9140000-0000-4000-8000-000000000001','coordinator','verified',now());
select set_config('request.jwt.claim.sub','e9120000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
set local role authenticated;
select public.sync_equipment_uma('UMAQA','test.csv',repeat('a',64),'[{"sheet":"CSV","row":2,"portfolio":"PIK","name":"[UJI] UMA Pump","tag":"TEST-001","serial":"S-001","asset":{"serial":"S-001","notes":"Patah"},"calibration":{"certificate_number":"C-1","issue_date":"2026-01-31","due_date":"2027-01-31","interval_months":12,"notes":"Patah","monitoring_measurements":[{"measurement_range":"0–10 L","correction_factor":"0,1\n0,2"}]}}]');
select pg_temp.uma_assert((select count(*)=1 from public.equipment where branch_code='UMAQA'),'one asset');
select pg_temp.uma_assert((select count(*)=1 from public.calibrations where branch_code='UMAQA'),'one calibration');
select public.sync_equipment_uma('UMAQA','blank-factors.csv',repeat('b',64),'[{"sheet":"CSV","row":2,"portfolio":"PIK","name":"[UJI] UMA Pump","tag":"TEST-001","asset":{},"calibration":{"monitoring_measurements":[{"measurement_range":"0–10 L","correction_factor":""}]}}]');
select pg_temp.uma_assert((select monitoring_measurements->0->>'correction_factor'=E'0,1\n0,2' from public.calibrations where branch_code='UMAQA'),'blank correction preserves previous values');
select pg_temp.uma_assert((public.sync_equipment_uma('UMAQA','test.csv',repeat('a',64),'[{"sheet":"CSV","row":2,"portfolio":"PIK","name":"[UJI] UMA Pump","tag":"TEST-001","serial":"S-001","asset":{"serial":"S-001","notes":"Patah"},"calibration":{"certificate_number":"C-1","issue_date":"2026-01-31","due_date":"2027-01-31","interval_months":12,"notes":"Patah","monitoring_measurements":[{"measurement_range":"0–10 L","correction_factor":"0,1\n0,2"}]}}]')->'rows'->0->>'calibration')='none','replay no new event');
select public.sync_equipment_uma('UMAQA','notes.csv',repeat('b',64),'[{"sheet":"CSV","row":2,"portfolio":"PIK","name":"[UJI] UMA Pump","tag":"TEST-001","asset":{"notes":"Sudah diperbaiki"},"calibration":{"notes":"Sudah diperbaiki"}}]');
select pg_temp.uma_assert((select notes='Sudah diperbaiki' and due_date='2027-01-31' from public.calibrations where branch_code='UMAQA'),'notes update preserves dates');
select public.sync_equipment_uma('UMAQA','date.csv',repeat('c',64),'[{"sheet":"CSV","row":2,"portfolio":"PIK","name":"[UJI] UMA Pump","tag":"TEST-001","asset":{},"calibration":{"certificate_number":"C-1","due_date":"2027-02-02"}}]');
select pg_temp.uma_assert((select count(*)=1 and max(due_date)='2027-02-02' from public.calibrations where branch_code='UMAQA'),'same certificate updates expiry');
select public.sync_equipment_uma('UMAQA','renewal.csv',repeat('d',64),'[{"sheet":"CSV","row":2,"portfolio":"PIK","name":"[UJI] UMA Pump","tag":"TEST-001","asset":{},"calibration":{"certificate_number":"C-2","issue_date":"2027-01-31","interval_months":12}}]');
select pg_temp.uma_assert((select count(*)=2 from public.calibrations where branch_code='UMAQA'),'new certificate retains old event');
select pg_temp.uma_assert((select due_date='2028-01-31' from public.calibrations where branch_code='UMAQA' and certificate_number='C-2'),'new expiry calculated');
select public.sync_equipment_uma('UMAQA','parallel.csv',repeat('d',64),'[{"sheet":"LAB","row":9,"portfolio":"PIK","name":"[UJI] UMA Pump","tag":"TEST-001","asset":{},"calibration":{"certificate_number":"C-3","issue_date":"2027-01-31","interval_months":12}},{"sheet":"LAB","row":15,"portfolio":"PIK","name":"[UJI] UMA Pump","tag":"TEST-001","asset":{},"calibration":{"certificate_number":"C-4","issue_date":"2027-01-31","interval_months":12}}]');
select pg_temp.uma_assert((select count(*)=1 from public.equipment where branch_code='UMAQA'),'parallel certificates do not duplicate equipment');
select pg_temp.uma_assert((select count(*)=4 from public.calibrations where branch_code='UMAQA'),'parallel certificates persist independently');
update public.calibrations set due_date_original='31-Jan-2028' where branch_code='UMAQA' and certificate_number='C-4';
select public.sync_equipment_uma('UMAQA','not-recorded.csv',repeat('a',64),'[{"sheet":"CSV","row":2,"portfolio":"PIK","name":"[UJI] UMA Pump","tag":"TEST-001","asset":{},"calibration":{"certificate_number":"C-4","due_date":null}}]');
select pg_temp.uma_assert((select due_date is null and calculated_due_date is null from public.calibrations where branch_code='UMAQA' and certificate_number='C-4'),'explicit N/A remains Not Recorded');
select pg_temp.uma_assert((select due_date_original='N/A' from public.calibrations where branch_code='UMAQA' and certificate_number='C-4'),'old display date does not return');
select pg_temp.uma_denied($q$select public.sync_equipment_uma('UMAQA','atomic.csv',repeat('e',64),'[{"sheet":"CSV","row":2,"portfolio":"PIK","name":"[UJI] UMA Pump","tag":"TEST-001","asset":{"notes":"Must rollback"},"calibration":{}},{"sheet":"CSV","row":3,"portfolio":"PIK","name":"[UJI] Bad Tool","tag":"TEST-002","asset":{},"calibration":{"certificate_number":"BAD","issue_date":"not a date"}}]')$q$);
select pg_temp.uma_assert(not exists(select 1 from public.equipment where branch_code='UMAQA' and notes='Must rollback'),'all-or-nothing notes');
select pg_temp.uma_assert(not exists(select 1 from public.equipment_sync_runs where branch_code='UMAQA' and source_name='atomic.csv'),'failed run rolled back');
select pg_temp.uma_denied($q$select public.sync_equipment_uma('UMAQA','serial.csv',repeat('e',64),'[{"sheet":"CSV","row":2,"portfolio":"PIK","name":"[UJI] UMA Pump","tag":"TEST-001","serial":"DIFFERENT","asset":{},"calibration":{}}]')$q$);
select pg_temp.uma_denied($q$select public.sync_equipment_uma('UMAQA','stale.csv',repeat('e',64),'[{"sheet":"CSV","row":2,"portfolio":"PIK","name":"[UJI] UMA Pump","tag":"TEST-001","asset":{},"calibration":{"certificate_number":"C-1"}}]')$q$);
-- Names may vary; strong tag/serial evidence selects the existing instrument.
select pg_temp.uma_assert((public.sync_equipment_uma('UMAQA','spelling.csv',repeat('c',64),'[{"sheet":"CSV","row":2,"portfolio":"PIK","name":"Pump spelling changed","tag":"TEST 001","serial":"S001","asset":{},"calibration":{}}]')->'rows'->0->>'match')='tag_serial','tag+serial match independent of display spelling');
-- Two distinct serials in the same source explicitly demonstrate a reused tag.
select public.sync_equipment_uma('UMAQA','new-shared-tag.csv',repeat('c',64),'[{"sheet":"CSV","row":2,"portfolio":"PIK","name":"[UJI] UMA Pump","tag":"TEST-001","serial":"S-001","asset":{"serial":"S-001"},"calibration":{}},{"sheet":"CSV","row":3,"portfolio":"PIK","name":"[UJI] New Pump","tag":"TEST-001","serial":"S-002","asset":{"serial":"S-002"},"calibration":{}}]');
select pg_temp.uma_assert((select count(*)=2 from public.equipment where branch_code='UMAQA'),'reused tag creates separate serial, not overwrite');
select pg_temp.uma_denied($q$select public.sync_equipment_uma('UMAQA','ambiguous.csv',repeat('c',64),'[{"sheet":"CSV","row":2,"portfolio":"PIK","name":"Unknown pump","tag":"TEST-001","asset":{},"calibration":{}}]')$q$);
select pg_temp.uma_denied($q$select public.sync_equipment_uma('UMAQA','inconsistent.csv',repeat('c',64),'[{"sheet":"CSV","row":2,"portfolio":"PIK","name":"[UJI] UMA Pump","tag":"TEST-001","serial":"S-001","asset":{"serial":"WRONG"},"calibration":{}}]')$q$);
select set_config('request.jwt.claim.sub','e9120000-0000-4000-8000-000000000003',true);
select public.sync_equipment_uma('UMAQA','coordinator.csv',repeat('f',64),'[{"sheet":"CSV","row":2,"portfolio":"PIK","name":"[UJI] UMA Pump","tag":"TEST-001","asset":{"item_status":"Terpakai"},"calibration":{}}]');
select pg_temp.uma_denied($q$select public.sync_equipment_uma('UMAQA','scope.csv',repeat('f',64),'[{"sheet":"CSV","row":2,"portfolio":"LAB","name":"[UJI] Outside Scope","tag":"OTHER","asset":{},"calibration":{}}]')$q$);
select set_config('request.jwt.claim.sub','e9120000-0000-4000-8000-000000000002',true);
select public.sync_equipment_uma('UMAQA','ptk.csv',repeat('f',64),'[{"sheet":"CSV","row":2,"portfolio":"PIK","name":"[UJI] UMA Pump","tag":"TEST-001","asset":{"item_condition":"Baik"},"calibration":{}}]');
select pg_temp.uma_denied($q$select public.sync_equipment_uma('DPS','branch.csv',repeat('f',64),'[{"sheet":"CSV","row":2,"portfolio":"PIK","name":"[UJI] Cross Branch","tag":"OTHER","asset":{},"calibration":{}}]')$q$);
select set_config('request.jwt.claim.sub','e9120000-0000-4000-8000-000000000004',true);
select pg_temp.uma_denied($q$select public.sync_equipment_uma('UMAQA','reader.csv',repeat('f',64),'[]')$q$);
select set_config('request.jwt.claim.sub','e9120000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
select pg_temp.uma_denied($q$select public.sync_equipment_uma('UMAQA','mfa.csv',repeat('f',64),'[]')$q$);
reset role;
select 'PASS: UMA create, replay, updates, history, rollback, serial, stale file, PTK, coordinator, reader, MFA and branch boundaries' as result;
rollback;
