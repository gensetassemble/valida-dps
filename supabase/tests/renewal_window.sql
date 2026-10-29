-- Date-window and internal-only equipment behavior. All fixtures roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(2);
create function pg_temp.assert_true(v boolean,label text) returns void language plpgsql as $$ begin if v is distinct from true then raise exception 'FAIL: %',label;end if;end $$;

-- Self-contained identity: also runs in a fresh local/CI database; everything rolls back.
insert into auth.users(id) values('ea900000-0000-4000-8000-000000000001');
insert into public.employee_directory(id,full_name,npp,branch_code,employment_status,verification_status,is_active) values('ea900000-0000-4000-8000-000000000001','[CONTOH] SQL test identity','99372','DPS','active','verified',true);
insert into public.profiles(id,employee_id,branch_code,is_active,activated_at,full_name) values('ea900000-0000-4000-8000-000000000001','ea900000-0000-4000-8000-000000000001','DPS',true,now(),'[CONTOH] SQL test profile');
insert into public.user_role_assignments(profile_id,role_code,branch_code,grant_reason) values('ea900000-0000-4000-8000-000000000001','tester','DPS','[CONTOH] Rollback-only capability verification.');
insert into public.clients(id,name,branch_code,is_example) values('ea100000-0000-4000-8000-000000000001','[CONTOH] Renewal window test','DPS',true);
insert into public.client_certificates(id,client_id,certificate_type_id,certificate_number,branch_code,verification_status,expiry_date,is_example)
select ('ea200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'ea100000-0000-4000-8000-000000000001',t.id,'[CONTOH] WINDOW/'||n,'DPS',case when n=5 then 'pending' else 'verified' end,(now() at time zone 'Asia/Makassar')::date+(array[-1,0,90,91,10,150,-20,365])[n],true
from generate_series(1,8)n cross join public.certificate_types t where t.code='CONTOH_KLIEN' and t.branch_code='DPS';
insert into public.renewal_opportunities(certificate_id,client_id,branch_code,stage) values('ea200000-0000-4000-8000-000000000006','ea100000-0000-4000-8000-000000000001','DPS','contacted');
update public.client_certificates set previous_certificate_id='ea200000-0000-4000-8000-000000000007' where id='ea200000-0000-4000-8000-000000000008';
insert into public.equipment(id,name,ownership,verification_status) values('ea300000-0000-4000-8000-000000000001','[CONTOH] Internal asset','internal','pending');
select pg_temp.assert_true((select eligibility_status='Belum Ada Kalibrasi' from public.equipment_records where id='ea300000-0000-4000-8000-000000000001'),'missing calibration is explicit without a review stage');
do $$ begin begin update public.equipment set client_id='ea100000-0000-4000-8000-000000000001' where id='ea300000-0000-4000-8000-000000000001';raise exception 'FAIL: internal asset with claimed client';exception when check_violation then null;end;end $$;
select pass('Internal equipment cannot claim a client owner');
select set_config('request.jwt.claim.sub','ea900000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=5 from public.renewal_board_records where client_id='ea100000-0000-4000-8000-000000000001'),'window includes supplied dates without a review stage, overdue/H0/H90 and open activity');
select pg_temp.assert_true((select count(*)=0 from public.renewal_board_records where id in ('ea200000-0000-4000-8000-000000000004','ea200000-0000-4000-8000-000000000007','ea200000-0000-4000-8000-000000000008')),'H91, replaced and far future certificates excluded');
reset role;
select pass('Renewal queue uses WITA H-90 without a review stage, retains activity, excludes replaced certificates');
select * from finish();
rollback;
