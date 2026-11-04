begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
create function pg_temp.client_assert(v boolean,msg text) returns void language plpgsql as $$begin if v is distinct from true then raise exception 'Client workbook: %',msg;end if;end$$;
insert into public.branches(code,name) values('CWQ','[CONTOH] Client QA');
insert into auth.users(id,email) values('ca100000-0000-4000-8000-000000000001','client-am@example.invalid');
insert into public.profiles(id,branch_code,full_name,is_active) values('ca100000-0000-4000-8000-000000000001','DPS','[CONTOH] Client AM',true);
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason) values('ca100000-0000-4000-8000-000000000001','DPS','account_manager','[CONTOH] Client QA');
insert into public.work_areas(id,branch_code,name) values('ca200000-0000-4000-8000-000000000001','DPS','[CONTOH] External region'),('ca200000-0000-4000-8000-000000000002','CWQ','[CONTOH] Other branch region');
insert into public.certificate_types(id,branch_code,code,name,category) values('ca300000-0000-4000-8000-000000000001','DPS','CLIENT_QA','[CONTOH] Client license','client');
insert into public.clients(id,branch_code,name,account_manager_id) values('ca400000-0000-4000-8000-000000000001','DPS','[CONTOH] Owned client','ca100000-0000-4000-8000-000000000001'),('ca400000-0000-4000-8000-000000000002','DPS','[CONTOH] Other client',null);
select set_config('request.jwt.claim.sub','ca100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
set local role authenticated;
insert into public.client_contacts(client_id,branch_code,name,email,is_primary,is_test) values('ca400000-0000-4000-8000-000000000001','DPS','[UJI] Internal recipient','test@example.invalid',true,true);
insert into public.client_certificates(id,branch_code,client_id,certificate_type_id,certificate_number,object_type,issue_date,interval_days,certificate_work_area_id)
 values('ca500000-0000-4000-8000-000000000001','DPS','ca400000-0000-4000-8000-000000000001','ca300000-0000-4000-8000-000000000001','[CONTOH] C-001','Aircraft','2026-10-21',56,'ca200000-0000-4000-8000-000000000001');
select pg_temp.client_assert((select expiry_date='2026-12-16' and interval_label='56 hari' and pic_is_test and pic_email='test@example.invalid' and work_area_name='[CONTOH] External region' from public.client_certificate_display_records where id='ca500000-0000-4000-8000-000000000001'),'day expiry, per-record region and explicit test contact');
do $$begin
 begin update public.client_certificates set interval_months=12 where id='ca500000-0000-4000-8000-000000000001';raise exception 'Expected dual-unit denial';exception when check_violation then null;end;
 begin update public.client_certificates set certificate_work_area_id='ca200000-0000-4000-8000-000000000002' where id='ca500000-0000-4000-8000-000000000001';raise exception 'Expected cross-branch denial';exception when foreign_key_violation then null;end;
end$$;
update public.client_certificates set expiry_date='2026-12-15' where id='ca500000-0000-4000-8000-000000000001';
select pg_temp.client_assert((select expiry_date='2026-12-15' from public.client_certificate_display_records where id='ca500000-0000-4000-8000-000000000001'),'explicit document dates are preserved');
insert into public.client_certificates(id,branch_code,client_id,certificate_type_id,certificate_number,object_type,issue_date,interval_months,previous_certificate_id)
 values('ca500000-0000-4000-8000-000000000002','DPS','ca400000-0000-4000-8000-000000000001','ca300000-0000-4000-8000-000000000001','[CONTOH] C-002','Aircraft','2026-12-16',12,'ca500000-0000-4000-8000-000000000001');
select pg_temp.client_assert((select superseded_by_certificate_id='ca500000-0000-4000-8000-000000000002' from public.client_certificate_display_records where id='ca500000-0000-4000-8000-000000000001'),'old generation links to the replacement');
select pg_temp.client_assert(not exists(select 1 from public.client_certificate_display_records where client_id='ca400000-0000-4000-8000-000000000002'),'AM cannot read another client');
reset role;
select pass('Client day/month dates, source geography, test contacts, replacement and RLS');
select * from finish();
rollback;
