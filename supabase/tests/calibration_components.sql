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
-- Isolated valve certificates; always roll back.
select public.sync_equipment_uma('UMAQA','valves.csv',repeat('a',64),'[{"sheet":"LAB","row":9,"portfolio":"PIK","name":"[UJI] Rotameter Impinger","tag":"VALVE-1","serial":"VS1","asset":{"serial":"VS1"},"calibration":{"certificate_number":"K-1236 A / KL","issue_date":"2026-01-01","due_date":"2027-01-01","interval_months":12}},{"sheet":"LAB","row":14,"portfolio":"PIK","name":"[UJI] Rotameter Impinger","tag":"VALVE-1","serial":"VS1","asset":{"serial":"VS1"},"calibration":{"certificate_number":"K-1236 B / KL","issue_date":"2026-01-01","due_date":"2027-01-10","interval_months":12}}]');
select pg_temp.uma_assert((select count(*)=1 from public.equipment where branch_code='UMAQA'),'valves retain one asset');
select pg_temp.uma_assert((select count(*)=2 from public.current_equipment_calibrations where branch_code='UMAQA'),'two current valves');
select pg_temp.uma_assert((select component_label='Katup A' from public.calibrations where branch_code='UMAQA' and certificate_number='K-1236 A / KL'),'letter A captured');
select public.sync_equipment_uma('UMAQA','renew-A.csv',repeat('b',64),'[{"sheet":"LAB","row":9,"portfolio":"PIK","name":"[UJI] Rotameter Impinger","tag":"VALVE-1","serial":"VS1","asset":{},"calibration":{"component_label":"Katup A","certificate_number":"NEW-2027-A","issue_date":"2027-01-01","due_date":"2028-01-01","interval_months":12}}]');
select pg_temp.uma_assert((select count(*)=3 from public.calibrations where branch_code='UMAQA'),'old valve certificate retained');
select pg_temp.uma_assert((select count(*)=2 from public.current_equipment_calibrations where branch_code='UMAQA'),'latest per valve only');
select pg_temp.uma_assert((select latest_due_date='2027-01-10' from public.equipment_records where branch_code='UMAQA'),'B expiry remains the instrument deadline after A is renewed');
select pg_temp.uma_assert((select monitoring_certificate='K-1236 B / KL' from public.equipment_monitoring_records where branch_code='UMAQA'),'monitoring points to the valve needing action');
select pg_temp.uma_assert((select count(*)=1 from public.calibration_monitoring_records where branch_code='UMAQA' and component_label='Katup B'),'component available in detail/form view');
select pg_temp.uma_denied($q$select public.sync_equipment_uma('UMAQA','old-A.csv',repeat('a',64),'[{"sheet":"LAB","row":9,"portfolio":"PIK","name":"[UJI] Rotameter Impinger","tag":"VALVE-1","serial":"VS1","asset":{},"calibration":{"certificate_number":"K-1236 A / KL"}}]')$q$);
reset role;
select 'PASS: one asset, independent valves, per-valve renewal, earliest current expiry, retained history' result;
rollback;
