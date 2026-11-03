begin;
-- Positive privileged fixtures represent a completed MFA verification.
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
create function pg_temp.assert_inbox(v boolean,msg text) returns void language plpgsql as $$begin if v is distinct from true then raise exception 'Inbox: %',msg;end if;end $$;
-- Every account/event below is a transaction-only fixture. No real read state is modified.
insert into auth.users(id,email) select ('bc110000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'inbox.qa.'||i||'@example.invalid' from generate_series(1,2)i;
insert into public.employee_directory(id,branch_code,full_name,employment_status) select ('bc220000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'DPS','[CONTOH] Inbox person '||i,'active' from generate_series(1,2)i;
insert into public.profiles(id,employee_id,branch_code,full_name,is_active) select ('bc110000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('bc220000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'DPS','[CONTOH] Inbox profile '||i,true from generate_series(1,2)i;
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason) values
 ('bc110000-0000-4000-8000-000000000001','DPS','hrga','[CONTOH] Inbox regression'),
 ('bc110000-0000-4000-8000-000000000002','DPS','inspector','[CONTOH] Inbox regression');
insert into public.certificate_types(id,code,name,category,branch_code) values('bc330000-0000-4000-8000-000000000001','CONTOH_INBOX','[CONTOH] Inbox license','personnel','DPS');
insert into public.personnel_certificates(id,branch_code,employee_id,certificate_type_id,original_title,certificate_number,issue_date,expiry_date) values('bc440000-0000-4000-8000-000000000001','DPS','bc220000-0000-4000-8000-000000000002','bc330000-0000-4000-8000-000000000001','[CONTOH] Searchable license','CONTOH/INBOX/123','2020-01-01','2021-01-01');
select set_config('request.jwt.claim.sub','bc110000-0000-4000-8000-000000000001',true);
set local role authenticated;
insert into public.personnel_renewal_cases(id,certificate_id,branch_code,notes) values('bc550000-0000-4000-8000-000000000001','bc440000-0000-4000-8000-000000000001','DPS','[CONTOH] Detailed original event');
update public.personnel_renewal_cases set status='processing',notes='[CONTOH] Processing event' where id='bc550000-0000-4000-8000-000000000001';
select pg_temp.assert_inbox((select count(*)=2 and count(distinct activity_group_id)=1 from public.notification_inbox_records where profile_id=auth.uid() and category='personnel'),'reliable process grouping without dropping events');
select pg_temp.assert_inbox((select count(*)=2 from public.notification_inbox_records where profile_id=auth.uid() and search_text ilike '%CONTOH/INBOX/123%' and context_name='[CONTOH] Inbox person 2'),'context/name/reference search follows access');
reset role;
select set_config('request.jwt.claim.sub','',true);
insert into public.user_notifications(branch_code,profile_id,event_id,title,href,created_at,read_at)
select 'DPS','bc110000-0000-4000-8000-000000000002',gen_random_uuid(),'[CONTOH] System event '||i,'/dashboard?branch=DPS',now()-i*interval '1 minute',case when i<=30 then now() end from generate_series(1,130)i;
insert into public.user_notifications(branch_code,profile_id,event_id,title,href) values('DPS','bc110000-0000-4000-8000-000000000002',gen_random_uuid(),'[CONTOH] Missing client target','/sertifikat-klien/bc660000-0000-4000-8000-000000000001?branch=DPS');
select set_config('request.jwt.claim.sub','bc110000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.assert_inbox(not exists(select 1 from public.notification_inbox_records where profile_id<>auth.uid()),'view isolates users including category counts');
select pg_temp.assert_inbox((select count(*)=130 from public.notification_inbox_records where category='system'),'100+ actual fixture rows without truncating counts');
select pg_temp.assert_inbox((select count(*)=25 from (select id from public.notification_inbox_records order by created_at desc,id desc limit 25 offset 25)s),'page two bounded to 25');
select pg_temp.assert_inbox((select target_href is null from public.notification_inbox_records where category='clients'),'missing target handled without invented metadata');
select pg_temp.assert_inbox((select count(*)=133 from public.notification_inbox_records),'projection never drops notification history');
update public.user_notifications set read_at=now() where profile_id='bc110000-0000-4000-8000-000000000001';
select pg_temp.assert_inbox((select count(*)=103 from public.notification_inbox_records where read_at is null),'cross-user marking does not affect own or other records');
update public.user_notifications set read_at=now() where profile_id=auth.uid() and id=(select id from public.user_notifications where profile_id=auth.uid() and read_at is null order by created_at desc,id desc limit 1);
select pg_temp.assert_inbox((select count(*)=102 from public.notification_inbox_records where read_at is null),'mark one persists and leaves other unread events unchanged');
update public.user_notifications set read_at=now() where profile_id=auth.uid() and read_at is null;
select pg_temp.assert_inbox(not exists(select 1 from public.notification_inbox_records where read_at is null),'mark all persists within transaction');
select pg_temp.assert_inbox((select count(*)=133 from public.notification_inbox_records),'mark read preserves all events');
select set_config('request.jwt.claim.sub','bc110000-0000-4000-8000-000000000001',true);
select pg_temp.assert_inbox((select count(*)=2 from public.notification_inbox_records where read_at is null),'other inbox unread state unchanged');
reset role;
select set_config('request.jwt.claim.sub','',true);
insert into public.portfolios(id,branch_code,code,name) values('bc880000-0000-4000-8000-000000000001','DPS','CONTOH_INBOX','[CONTOH] Inbox portfolio');
insert into public.equipment(id,branch_code,portfolio_id,name,tag) values('bc990000-0000-4000-8000-000000000001','DPS','bc880000-0000-4000-8000-000000000001','[CONTOH] Inbox equipment','QA-TAG-1');
insert into public.user_notifications(id,branch_code,profile_id,event_id,title,href) values
 ('bc770000-0000-4000-8000-000000000001','DPS','bc110000-0000-4000-8000-000000000001',gen_random_uuid(),'[CONTOH] Calibration context','/kalibrasi-alat/bc990000-0000-4000-8000-000000000001?branch=DPS'),
 ('bc770000-0000-4000-8000-000000000002','DPS','bc110000-0000-4000-8000-000000000002',gen_random_uuid(),'[CONTOH] Unavailable equipment','/kalibrasi-alat/bc990000-0000-4000-8000-000000000001?branch=DPS');
select set_config('request.jwt.claim.sub','bc110000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.assert_inbox(private.notification_inbox_context('bc770000-0000-4000-8000-000000000001')='{}'::jsonb,'context helper rejects another inbox notification');
select pg_temp.assert_inbox((select context_name is null and target_href is null from public.notification_inbox_records where id='bc770000-0000-4000-8000-000000000002'),'equipment metadata cannot bypass portfolio/module RLS');
reset role;
select set_config('request.jwt.claim.sub','',true);
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason) values('bc110000-0000-4000-8000-000000000001','DPS','admin','[CONTOH] Context regression');
insert into public.clients(id,branch_code,name) values('bcaa0000-0000-4000-8000-000000000001','DPS','[CONTOH] Inbox client');
insert into public.certificate_types(id,branch_code,code,name,category) values('bcab0000-0000-4000-8000-000000000001','DPS','CONTOH_INBOX_CLIENT','[CONTOH] Client type','client');
insert into public.client_certificates(id,branch_code,client_id,certificate_type_id,certificate_number) values('bcac0000-0000-4000-8000-000000000001','DPS','bcaa0000-0000-4000-8000-000000000001','bcab0000-0000-4000-8000-000000000001','QA-CLIENT-1');
insert into public.user_notifications(branch_code,profile_id,event_id,title,href) values('DPS','bc110000-0000-4000-8000-000000000001',gen_random_uuid(),'[CONTOH] Client context','/sertifikat-klien/bcac0000-0000-4000-8000-000000000001?branch=DPS');
select set_config('request.jwt.claim.sub','bc110000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.assert_inbox((select context_name='[CONTOH] Inbox equipment' and reference_number='QA-TAG-1' and portfolio_code='CONTOH_INBOX' from public.notification_inbox_records where category='calibrations'),'actual equipment and portfolio context');
select pg_temp.assert_inbox((select context_name='[CONTOH] Inbox client' and reference_number='QA-CLIENT-1' from public.notification_inbox_records where category='clients'),'actual client context');
reset role;
select pass('Notification projection, grouping, own-inbox RLS, accurate counts, pagination and read persistence');
select * from finish();
rollback;
