begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
-- All identities, documents, queues and delivery events are synthetic and rolled back.
create function pg_temp.check_email(v boolean,msg text) returns void language plpgsql as $$begin if v is distinct from true then raise exception 'Email QA: %',msg;end if;end $$;
create function pg_temp.denied_email(statement text) returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'Email QA expected denial';end $$;
create function pg_temp.enqueue_validated_email(b text,certificate uuid,pic uuid,delivery_mode text,email_subject text,email_body text) returns uuid language sql as $$
 select public.enqueue_client_renewal_email(b,certificate,pic,delivery_mode,email_subject,email_body,'ad920000-0000-4000-8000-000000000001',
 (select md5(concat_ws('|',c.id,c.expiry_date,c.certificate_number,c.client_id,c.client_name,c.certificate_type_name,c.object_type,c.object_serial,c.installation_location,c.scope_portfolio_id)) from public.client_certificate_display_records c where c.branch_code=b and c.id=certificate),0);
$$;
select pg_temp.check_email(not has_function_privilege('authenticated','public.enqueue_client_renewal_email(text,uuid,uuid,text,text,text,uuid,text,integer)','execute'),'Browser can enqueue arbitrary content');
select pg_temp.check_email(not has_function_privilege('authenticated','public.enqueue_client_renewal_email(text,uuid,uuid,text,text,text)','execute'),'Legacy browser queue still open');
insert into public.branches(code,name) values('EMQ','[UJI] Email QA');
insert into auth.users(id,email,email_confirmed_at) values('ad920000-0000-4000-8000-000000000001','synthetic-email-qa@sucofindo.co.id',now());
insert into public.employee_directory(id,branch_code,full_name,employment_status,verification_status,is_active) values
 ('ad920000-0000-4000-8000-000000000002','EMQ','[UJI] Email QA Owner','active','verified',true),
 ('ad920000-0000-4000-8000-000000000003','EMQ','[UJI] Email QA Resigned','active','verified',false);
insert into public.profiles(id,employee_id,branch_code,full_name,email,is_active) values
 ('ad920000-0000-4000-8000-000000000001','ad920000-0000-4000-8000-000000000002','EMQ','[UJI] Email QA','synthetic-email-qa@sucofindo.co.id',true);
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason,is_active)
 select 'ad920000-0000-4000-8000-000000000001','EMQ',r,'Synthetic email QA fixture',true from unnest(array['super_admin','hrga','account_manager','equipment_manager'])r;
insert into public.portfolios(id,branch_code,code,name) values('ad920000-0000-4000-8000-000000000004','EMQ','PIK','[UJI] PIK');
insert into public.certificate_types(id,branch_code,code,name,category) values
 ('ad920000-0000-4000-8000-000000000005','EMQ','CLIENT','[UJI] Client License','client'),
 ('ad920000-0000-4000-8000-000000000006','EMQ','PERSON','[UJI] Personnel License','personnel');
insert into public.clients(id,branch_code,name,account_manager_id,assignment_reason,is_active)
 values('ad920000-0000-4000-8000-000000000007','EMQ','[UJI] Email Customer','ad920000-0000-4000-8000-000000000001','Synthetic assignment',true);
insert into public.client_contacts(id,branch_code,client_id,name,email,is_primary,verification_status,is_active)
 values('ad920000-0000-4000-8000-000000000008','EMQ','ad920000-0000-4000-8000-000000000007','[UJI] Official PIC','official-pic@example.invalid',true,'verified',true);
insert into public.client_certificates(id,branch_code,client_id,certificate_type_id,certificate_number,object_type,issue_date,expiry_date,is_active)
 values('ad920000-0000-4000-8000-000000000009','EMQ','ad920000-0000-4000-8000-000000000007','ad920000-0000-4000-8000-000000000005','QA-CERT','[UJI] Object',current_date-358,current_date+7,true);
insert into public.personnel_certificates(id,branch_code,employee_id,certificate_type_id,original_title,certificate_number,expiry_date,portfolio_id,is_active)
 values('ad920000-0000-4000-8000-000000000010','EMQ','ad920000-0000-4000-8000-000000000002','ad920000-0000-4000-8000-000000000006','[UJI] License','QA-PERSON',current_date+7,'ad920000-0000-4000-8000-000000000004',true),
 ('ad920000-0000-4000-8000-000000000011','EMQ','ad920000-0000-4000-8000-000000000003','ad920000-0000-4000-8000-000000000006','[UJI] License Resigned','QA-INACTIVE',current_date+7,'ad920000-0000-4000-8000-000000000004',true);
insert into public.equipment(id,branch_code,name,ownership,portfolio_id,is_active) values('ad920000-0000-4000-8000-000000000012','EMQ','[UJI] Instrument','internal','ad920000-0000-4000-8000-000000000004',true);
insert into public.calibrations(equipment_id,branch_code,certificate_number,calibration_date,due_date,is_active) values('ad920000-0000-4000-8000-000000000012','EMQ','QA-CALIBRATION',current_date-358,current_date+7,true);
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal2","sub":"ad920000-0000-4000-8000-000000000001"}',true);
select set_config('request.jwt.claim.sub','ad920000-0000-4000-8000-000000000001',true);
set local role authenticated;
update public.employee_directory set employment_status='inactive',employment_status_reason='resigned',employment_status_note='Synthetic resigned fixture',employment_status_effective_on=(now() at time zone 'Asia/Makassar')::date where id='ad920000-0000-4000-8000-000000000003';
select public.configure_email_reminders('EMQ',true,array[90,60,30,7,0,-7,-30]);
select pg_temp.denied_email($q$select public.enqueue_due_email_reminders('test')$q$);
select pg_temp.denied_email($q$select pg_temp.enqueue_validated_email('DPS','ad920000-0000-4000-8000-000000000009',null,'test','QA subject','Synthetic email body for QA only')$q$);

select set_config('request.jwt.claims','{"role":"service_role","aal":"aal2","sub":"ad920000-0000-4000-8000-000000000001"}',true);
set local role service_role;
do $$ declare a uuid;b uuid;begin
 a:=pg_temp.enqueue_validated_email('EMQ','ad920000-0000-4000-8000-000000000009',null,'test','QA subject','Synthetic email body for QA only');
 b:=pg_temp.enqueue_validated_email('EMQ','ad920000-0000-4000-8000-000000000009',null,'test','QA subject','Synthetic email body for QA only');
 perform pg_temp.check_email(a=b,'Repeated confirmations duplicated a job');
 perform pg_temp.check_email((select recipient from public.email_outbox where id=a)='adli.alfian@sucofindo.co.id','Test recipient escaped allowlist');
end $$;
select pg_temp.check_email(public.enqueue_due_email_reminders('test')=3,'Expected one reminder for each active domain; inactive owner excluded');
select pg_temp.check_email(public.enqueue_due_email_reminders('test')=0,'Reminder jobs duplicated on repeated cron');
do $$ declare job public.email_outbox;begin
 select * into job from public.claim_email_deliveries(1,'test',(select id from public.email_outbox where branch_code='EMQ' and kind='renewal'));
 perform pg_temp.check_email(job.state='sending','Job was not claimed');
 perform pg_temp.check_email((select count(*)=0 from public.claim_email_deliveries(1,'test',job.id)),'Second worker claimed the same job');
 perform pg_temp.check_email(not public.finish_email_delivery(job.id,gen_random_uuid(),'accepted','GRAPH_ACCEPTED','synthetic'),'Wrong claim token completed delivery');
 perform pg_temp.check_email(public.finish_email_delivery(job.id,job.claim_token,'accepted','GRAPH_ACCEPTED','synthetic'),'Provider acceptance was not recorded');
 perform pg_temp.check_email((select count(*)=0 from public.claim_email_deliveries(1,'test',job.id)),'Accepted mail was resent');
 select * into job from public.claim_email_deliveries(1,'test',(select id from public.email_outbox where branch_code='EMQ' and kind='reminder' and domain='personnel'));
 perform public.finish_email_delivery(job.id,job.claim_token,'uncertain','GRAPH_RESPONSE_UNKNOWN',null);
 perform pg_temp.check_email((select count(*)=0 from public.claim_email_deliveries(1,'test',job.id)),'Uncertain delivery was retried');
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal2","sub":"ad920000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
select pg_temp.denied_email($q$select public.manage_email_delivery('EMQ',(select id from public.email_outbox where branch_code='EMQ' and state='uncertain'),'retry','Synthetic unsafe retry')$q$);
select pg_temp.check_email((select count(*)>5 from public.email_delivery_events e join public.email_outbox o on o.id=e.outbox_id where o.branch_code='EMQ'),'Delivery audit is incomplete');
do $$ declare job uuid;begin
 select id into job from public.email_outbox where branch_code='EMQ' and kind='reminder' and domain='calibrations';
 perform public.manage_email_delivery('EMQ',job,'cancel','Synthetic cancellation for QA');
 perform pg_temp.check_email((select state='cancelled' from public.email_outbox where id=job),'Pending job cancellation failed');
 perform public.manage_email_delivery('EMQ',job,'retry','Synthetic cancellation recovery');
 perform pg_temp.check_email((select state='pending' from public.email_outbox where id=job),'Safe cancellation recovery failed');
end $$;
-- Changing the certificate invalidates a queued snapshot before dispatch.
update public.client_certificates set expiry_date=expiry_date+1 where id='ad920000-0000-4000-8000-000000000009';
select set_config('request.jwt.claims','{"role":"service_role","aal":"aal2","sub":"ad920000-0000-4000-8000-000000000001"}',true);
set local role service_role;
do $$ declare job uuid;begin
 select id into job from public.email_outbox where branch_code='EMQ' and kind='reminder' and domain='clients';
 perform pg_temp.check_email((select count(*)=0 from public.claim_email_deliveries(1,'test',job)),'Stale certificate email was dispatched');
 perform pg_temp.check_email((select result_code='SOURCE_CHANGED' from public.email_outbox where id=job),'Stale source not cancelled');
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal2","sub":"ad920000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
-- Removing the previous threshold cancels old queued reminders, rather than
-- sending an H-7 snapshot after its useful window has passed.
select public.configure_email_reminders('EMQ',true,array[0,-7]);
select set_config('request.jwt.claims','{"role":"service_role","aal":"aal2","sub":"ad920000-0000-4000-8000-000000000001"}',true);
set local role service_role;
do $$ declare job uuid;begin
 select id into job from public.email_outbox where branch_code='EMQ' and kind='reminder' and domain='calibrations';
 perform pg_temp.check_email((select count(*)=0 from public.claim_email_deliveries(1,'test',job)),'Outdated reminder threshold was dispatched');
 perform pg_temp.check_email((select result_code='REMINDER_WINDOW_CHANGED' from public.email_outbox where id=job),'Outdated reminder window not cancelled');
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal2","sub":"ad920000-0000-4000-8000-000000000088"}',true);
select set_config('request.jwt.claim.sub','ad920000-0000-4000-8000-000000000088',true);
set local role authenticated;
select pg_temp.check_email((select count(*)=0 from public.email_outbox where branch_code='EMQ'),'Unauthorized account can see email audit');
select pg_temp.denied_email($q$select public.configure_email_reminders('EMQ',false,array[7,0])$q$);
reset role;
select pass('Email authorization, idempotency, claims, lifecycle, inactive owners, audit and reminder freshness');
select * from finish();
reset role;
rollback;
