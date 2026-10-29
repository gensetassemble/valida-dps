begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
create function pg_temp.assert_true(v boolean,label text) returns void language plpgsql as $$begin if v is distinct from true then raise exception 'FAIL: %',label;end if;end $$;

-- Self-contained identity: also runs in a fresh local/CI database; everything rolls back.
insert into auth.users(id) values('ec900000-0000-4000-8000-000000000001');
insert into public.employee_directory(id,full_name,npp,branch_code,employment_status,verification_status,is_active) values('ec900000-0000-4000-8000-000000000001','[CONTOH] SQL test identity','99371','DPS','active','verified',true);
insert into public.profiles(id,employee_id,branch_code,is_active,activated_at,full_name) values('ec900000-0000-4000-8000-000000000001','ec900000-0000-4000-8000-000000000001','DPS',true,now(),'[CONTOH] SQL test profile');
insert into public.user_role_assignments(profile_id,role_code,branch_code,grant_reason) values('ec900000-0000-4000-8000-000000000001','super_admin','DPS','[CONTOH] Rollback-only capability verification.');
insert into public.branches(code,name) values('MKTEST','[CONTOH] Roster branch');
insert into public.marketing_contacts(id,branch_code,full_name) values('ec100000-0000-4000-8000-000000000001','DPS','[CONTOH] AM Search Fixture'),('ec100000-0000-4000-8000-000000000002','MKTEST','[CONTOH] Outside Roster');
insert into public.clients(id,branch_code,name,is_example,marketing_contact_id) values('ec200000-0000-4000-8000-000000000001','DPS','[CONTOH] Search Customer',true,'ec100000-0000-4000-8000-000000000001');
insert into public.client_certificates(id,branch_code,client_id,certificate_type_id,certificate_number,object_type,expiry_date,previous_order_value,is_example)
select 'ec300000-0000-4000-8000-000000000001','DPS','ec200000-0000-4000-8000-000000000001',id,'[CONTOH] SEARCH-20261029','[CONTOH] Crane Search Fixture',(now() at time zone 'Asia/Makassar')::date+10,123456789.25,true from public.certificate_types where branch_code='DPS' and code='CONTOH_KLIEN';
select set_config('request.jwt.claim.sub','ec900000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.assert_true((public.pipeline_search_totals('DPS','SEARCH-20261029',true)->'uncontacted'->>'count')::integer=1,'certificate search filters counts');
select pg_temp.assert_true((public.pipeline_search_totals('DPS','AM Search Fixture',true)->'uncontacted'->>'amount')::numeric=123456789.25,'AM search filters exact money total');
select pg_temp.assert_true(public.pipeline_search_totals('DPS','SEARCH-20261029',false)='{}'::jsonb,'example toggle is respected by search');
select pg_temp.assert_true(public.pipeline_search_totals('DPS','SEARCH-20261029 unmatchedword',true)='{}'::jsonb,'every search term must match');
select pg_temp.assert_true(public.renewal_board_page('DPS','SEARCH-20261029',true)->'summary'=public.pipeline_search_totals('DPS','SEARCH-20261029',true),'single-scan board preserves exact filtered totals');
select pg_temp.assert_true(jsonb_array_length(public.renewal_board_page('DPS','SEARCH-20261029',true)->'columns'->'uncontacted')=1,'single-scan board returns the searched card');
select pg_temp.assert_true(public.renewal_board_page('DPS','SEARCH-20261029',false)->'columns'='{}'::jsonb,'single-scan board respects example toggle');
select pg_temp.assert_true(jsonb_array_length(public.renewal_board_page('DPS','',true,'{"uncontacted":1}'::jsonb)->'columns'->'uncontacted')=1,'stage slices respect bounded requested size');
select pg_temp.assert_true(public.renewal_board_page('MKTEST','',true)->'summary'='{}'::jsonb,'single-scan board respects branch authorization');
select pg_temp.assert_true((select count(*)=0 from public.marketing_contacts where branch_code='MKTEST'),'roster respects branch access');
select pg_temp.assert_true((select account_manager_name='[CONTOH] AM Search Fixture' from public.client_certificate_display_records where id='ec300000-0000-4000-8000-000000000001'),'business AM label is available without a login');
do $$begin
 begin update public.clients set marketing_contact_id='ec100000-0000-4000-8000-000000000002' where id='ec200000-0000-4000-8000-000000000001';raise exception 'FAIL: cross-branch marketing assignment';exception when foreign_key_violation then null;end;
 begin insert into public.marketing_contacts(branch_code,full_name) values('DPS','[CONTOH] Unapproved roster edit');raise exception 'FAIL: app can change fixed roster';exception when insufficient_privilege then null;end;
end $$;
select pg_temp.assert_true((public.operational_summary('DPS','{"category":"clients","examples":"true","marketing":"ec100000-0000-4000-8000-000000000001"}'::jsonb)->>'total')::integer=1,'dashboard filters official AM consistently');
set local role anon;
do $$begin begin perform * from public.marketing_contacts;raise exception 'FAIL: anonymous roster read';exception when insufficient_privilege then null;end;end $$;
reset role;
select pass('Pipeline search, exact totals, official business roster, branch scope and dashboard filtering');
select * from finish();
rollback;
