begin;
create function pg_temp.qc_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'QC: %',label;end if;end $$;
create function pg_temp.qc_denied(q text,code text default '42501') returns void language plpgsql as $$begin
 begin execute q;exception when others then if sqlstate=code then return;end if;raise;end;raise exception 'QC expected rejection: %',q;end $$;
insert into public.branches(code,name) values('QCQA','[UJI] QC'),('QCQB','[UJI] Outside QC');
insert into auth.users(id) select ('db110000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,6)i;
insert into public.employee_directory(id,branch_code,full_name,employment_status,verification_status,is_active)
select ('db120000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'QCQA','[UJI] QC user '||i,'active','verified',true from generate_series(1,6)i;
insert into public.profiles(id,employee_id,branch_code,full_name,is_active,activated_at)
select ('db110000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('db120000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'QCQA','[UJI] QC user '||i,true,now() from generate_series(1,6)i;
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason)
select ('db110000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'QCQA',(array['qshe','hrga','equipment_manager','inspector','super_admin','admin'])[i],'[UJI] QC test' from generate_series(1,6)i;
insert into public.portfolios(id,branch_code,code,name) values('db130000-0000-4000-8000-000000000001','QCQA','QC','[UJI] QC Portfolio');
insert into public.employee_portfolio_assignments(branch_code,employee_id,portfolio_id,assignment_type,verification_status,approved_at)
values('QCQA','db120000-0000-4000-8000-000000000001','db130000-0000-4000-8000-000000000001','qshe','verified',now()),('QCQA','db120000-0000-4000-8000-000000000003','db130000-0000-4000-8000-000000000001','equipment_responsible','verified',now());
insert into public.equipment(id,branch_code,name,ownership,portfolio_id)
values('db140000-0000-4000-8000-000000000001','QCQA','[UJI] QC Tool','internal','db130000-0000-4000-8000-000000000001');
insert into public.calibrations(id,branch_code,equipment_id,certificate_number,issue_date,due_date)
values('db150000-0000-4000-8000-000000000001','QCQA','db140000-0000-4000-8000-000000000001','QC-CAL-1','2026-01-01','2027-01-01');
insert into public.certificate_types(id,branch_code,code,name,category)
values('db160000-0000-4000-8000-000000000001','QCQA','QC','[UJI] Competency','personnel');
insert into public.personnel_certificates(id,branch_code,employee_id,certificate_type_id,original_title,issue_date,expiry_date)
values('db170000-0000-4000-8000-000000000001','QCQA','db120000-0000-4000-8000-000000000004','db160000-0000-4000-8000-000000000001','[UJI] QC Competency','2026-01-01','2027-01-01');
create temp table qc_ids(domain text primary key,id uuid);
grant all on qc_ids to authenticated;
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
select set_config('request.jwt.claim.sub','db110000-0000-4000-8000-000000000001',true);
set local role authenticated;
insert into qc_ids values('calibration',public.submit_certificate_qc('QCQA','calibration','db150000-0000-4000-8000-000000000001',null,'open','Nomor seri perlu diperiksa','Salah serial',0,'db180000-0000-4000-8000-000000000001'));
insert into qc_ids values('personnel',public.submit_certificate_qc('QCQA','personnel','db170000-0000-4000-8000-000000000001',null,'open','Alamat penerbit berbeda','Periksa alamat',0,'db180000-0000-4000-8000-000000000002'));
select pg_temp.qc_assert(public.submit_certificate_qc('QCQA','calibration','db150000-0000-4000-8000-000000000001',null,'open','Nomor seri perlu diperiksa','Salah serial',0,'db180000-0000-4000-8000-000000000001')=(select id from qc_ids where domain='calibration'),'opening retry idempotent');
select pg_temp.qc_assert((select count(*)=2 from public.certificate_qc_threads where branch_code='QCQA'),'no duplicate findings');
select pg_temp.qc_denied($q$insert into public.certificate_qc_threads(branch_code,title,created_by,request_key,personnel_certificate_id) values('QCQA','Bypass',auth.uid(),gen_random_uuid(),'db170000-0000-4000-8000-000000000001')$q$);
select pg_temp.qc_denied($q$select public.submit_certificate_qc('QCQB','personnel','db170000-0000-4000-8000-000000000001',null,'open','Wrong branch','Wrong',0,gen_random_uuid())$q$);
select set_config('request.jwt.claim.sub','db110000-0000-4000-8000-000000000003',true);
select pg_temp.qc_assert((select count(*)=1 from public.notification_user_feed where branch_code='QCQA' and category='qc' and target_href like '%#qc-%'),'PTK gets only equipment notification with deep link');
select public.submit_certificate_qc('QCQA','calibration','db150000-0000-4000-8000-000000000001',(select id from qc_ids where domain='calibration'),'reply','Sudah diminta revisi','',1,'db180000-0000-4000-8000-000000000003');
select pg_temp.qc_assert((select status='in_progress' from public.certificate_qc_threads where id=(select id from qc_ids where domain='calibration')),'PTK reply updates status');
select public.submit_certificate_qc('QCQA','calibration','db150000-0000-4000-8000-000000000001',(select id from qc_ids where domain='calibration'),'request_review','','',2,'db180000-0000-4000-8000-000000000004');
select pg_temp.qc_assert((select status='awaiting_qshe' from public.certificate_qc_threads where id=(select id from qc_ids where domain='calibration')),'one-click review request');
select pg_temp.qc_denied($q$select public.submit_certificate_qc('QCQA','calibration','db150000-0000-4000-8000-000000000001',(select id from qc_ids where domain='calibration'),'close','','',3,gen_random_uuid())$q$);
select pg_temp.qc_denied($q$select public.submit_certificate_qc('QCQA','calibration','db150000-0000-4000-8000-000000000001',(select id from qc_ids where domain='calibration'),'reply','Stale reply','',1,gen_random_uuid())$q$,'40001');
select set_config('request.jwt.claim.sub','db110000-0000-4000-8000-000000000002',true);
select pg_temp.qc_assert((select count(*)=1 from public.notification_user_feed where branch_code='QCQA' and category='qc'),'HRGA gets competency finding');
select public.submit_certificate_qc('QCQA','personnel','db170000-0000-4000-8000-000000000001',(select id from qc_ids where domain='personnel'),'reply','Sudah dihubungi','',1,'db180000-0000-4000-8000-000000000005');
select pg_temp.qc_denied($q$select public.submit_certificate_qc('QCQA','personnel','db170000-0000-4000-8000-000000000001',(select id from qc_ids where domain='personnel'),'close','','',2,gen_random_uuid())$q$);
select set_config('request.jwt.claim.sub','db110000-0000-4000-8000-000000000004',true);
select pg_temp.qc_denied($q$select public.submit_certificate_qc('QCQA','personnel','db170000-0000-4000-8000-000000000001',(select id from qc_ids where domain='personnel'),'reply','Forbidden','',2,gen_random_uuid())$q$);
select set_config('request.jwt.claim.sub','db110000-0000-4000-8000-000000000006',true);
select pg_temp.qc_denied($q$select public.submit_certificate_qc('QCQA','personnel','db170000-0000-4000-8000-000000000001',(select id from qc_ids where domain='personnel'),'close','','',2,gen_random_uuid())$q$);
select set_config('request.jwt.claim.sub','db110000-0000-4000-8000-000000000001',true);
select pg_temp.qc_assert(exists(select 1 from public.notification_user_feed where category='qc' and current_status='qc_awaiting_qshe'),'QSHE gets review status');
select public.submit_certificate_qc('QCQA','calibration','db150000-0000-4000-8000-000000000001',(select id from qc_ids where domain='calibration'),'close','','',3,'db180000-0000-4000-8000-000000000006');
select pg_temp.qc_assert((select status='closed' from public.certificate_qc_threads where id=(select id from qc_ids where domain='calibration')),'close without mandatory note');
select public.submit_certificate_qc('QCQA','calibration','db150000-0000-4000-8000-000000000001',(select id from qc_ids where domain='calibration'),'reopen','Nomor seri masih berbeda','',4,'db180000-0000-4000-8000-000000000007');
select pg_temp.qc_assert((select status='open' and version=5 from public.certificate_qc_threads where id=(select id from qc_ids where domain='calibration')),'reopen preserves same thread');
select pg_temp.qc_assert((select count(*)=5 from public.certificate_qc_posts where thread_id=(select id from qc_ids where domain='calibration')),'all conversation events retained');
do $$ declare changed integer;begin
 update public.personnel_certificates set certificate_number='Forbidden' where branch_code='QCQA';get diagnostics changed=row_count;
 perform pg_temp.qc_assert(changed=0,'QSHE cannot edit certificate');
 update public.user_notifications set read_at=now() where branch_code='QCQA';
 perform pg_temp.qc_assert((select status='open' from public.certificate_qc_threads where id=(select id from qc_ids where domain='calibration')),'read does not close finding');
end $$;
select set_config('request.jwt.claim.sub','db110000-0000-4000-8000-000000000005',true);
select public.submit_certificate_qc('QCQA','calibration','db150000-0000-4000-8000-000000000001',(select id from qc_ids where domain='calibration'),'reply','Mohon cek nomor seri sekali lagi','',5,'db180000-0000-4000-8000-000000000008');
select pg_temp.qc_assert((select status='open' from public.certificate_qc_threads where id=(select id from qc_ids where domain='calibration')),'Super Admin replies as reviewer');
select set_config('request.jwt.claim.sub','db110000-0000-4000-8000-000000000003',true);
select pg_temp.qc_assert(exists(select 1 from public.notification_user_feed where category='qc' and title like 'Balasan catatan QC:%'),'PTK receives Super Admin reviewer reply');
reset role;
select pg_temp.qc_assert((select certificate_number='QC-CAL-1' and issue_date='2026-01-01' and due_date='2027-01-01' from public.calibrations where id='db150000-0000-4000-8000-000000000001'),'QC leaves certificate data intact');
select 'PASS: QC lifecycle, two domains, recipient isolation, deep links, role security, concurrency, idempotency, and unchanged certificate data' as result;
rollback;
