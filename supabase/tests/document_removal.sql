begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
create function pg_temp.check_document(v boolean,msg text) returns void language plpgsql as $$begin if v is distinct from true then raise exception 'Document test: %',msg;end if;end $$;
create function pg_temp.denied_document(statement text,expected text) returns void language plpgsql as $$begin
 begin execute statement; exception when others then if sqlstate=expected then return;end if;raise;end;
 raise exception 'Expected rejection: %',statement;
end $$;
insert into public.branches(code,name) values('DOCQ','[UJI] Document QA'),('DOCX','[UJI] Other branch');
insert into auth.users(id,email) select ('cf110000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'document.qa.'||i||'@example.invalid' from generate_series(1,5)i;
insert into public.employee_directory(id,branch_code,full_name,employment_status,verification_status,is_active)
 select ('cf120000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=3 then 'DOCX' else 'DOCQ' end,'[UJI] Document Person '||i,'active','verified',true from generate_series(1,5)i;
insert into public.profiles(id,employee_id,branch_code,full_name,is_active)
 select ('cf110000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('cf120000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=3 then 'DOCX' else 'DOCQ' end,'[UJI] Document User '||i,true from generate_series(1,5)i;
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason)
 select ('cf110000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=3 then 'DOCX' else 'DOCQ' end,(array['hrga','branch_head','hrga','super_admin','equipment_manager'])[i],'[UJI] Document regression' from generate_series(1,5)i;
insert into public.certificate_types(id,branch_code,code,name,category) values
 ('cf130000-0000-4000-8000-000000000001','DOCQ','UJI_DOC_LIC','[UJI] Document License','personnel'),
 ('cf130000-0000-4000-8000-000000000002','DOCQ','UJI_DOC_CLIENT','[UJI] Client License','client');
insert into public.personnel_certificates(id,branch_code,employee_id,certificate_type_id,original_title,certificate_number,issue_date,expiry_date)
 values('cf140000-0000-4000-8000-000000000001','DOCQ','cf120000-0000-4000-8000-000000000001','cf130000-0000-4000-8000-000000000001','[UJI] Document License','UJI-UNCHANGED','2025-01-01','2027-01-01');
insert into public.clients(id,branch_code,name) values('cf150000-0000-4000-8000-000000000001','DOCQ','[UJI] Document Client');
insert into public.client_certificates(id,branch_code,client_id,certificate_type_id) values('cf160000-0000-4000-8000-000000000001','DOCQ','cf150000-0000-4000-8000-000000000001','cf130000-0000-4000-8000-000000000002');
insert into public.portfolios(id,branch_code,code,name) values('cf171000-0000-4000-8000-000000000001','DOCQ','UJI_DOC','[UJI] Document portfolio');
insert into public.employee_portfolio_assignments(employee_id,portfolio_id,branch_code,assignment_type,effective_from,verification_status,is_active)
 values('cf120000-0000-4000-8000-000000000005','cf171000-0000-4000-8000-000000000001','DOCQ','equipment_responsible','2020-01-01','verified',true);
insert into public.equipment(id,branch_code,portfolio_id,name) values('cf170000-0000-4000-8000-000000000001','DOCQ','cf171000-0000-4000-8000-000000000001','[UJI] Equipment');
insert into public.calibrations(id,branch_code,equipment_id) values('cf180000-0000-4000-8000-000000000001','DOCQ','cf170000-0000-4000-8000-000000000001');
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
select set_config('request.jwt.claim.sub','cf110000-0000-4000-8000-000000000004',true);
insert into public.operational_documents(id,branch_code,domain,record_id,kind,object_path,original_name,file_bytes,created_by)
 select ('cf190000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'DOCQ','personnel','cf140000-0000-4000-8000-000000000001','certificate',
 'DOCQ/personnel/cf140000-0000-4000-8000-000000000001/cf190000-0000-4000-8000-'||lpad(i::text,12,'0')||'.pdf','[UJI] Duplicate.pdf',20,'cf110000-0000-4000-8000-000000000004' from generate_series(1,2)i;
insert into public.operational_documents(id,branch_code,domain,record_id,kind,object_path,original_name,file_bytes,created_by) values
 ('cf190000-0000-4000-8000-000000000003','DOCQ','client','cf160000-0000-4000-8000-000000000001','quotation','DOCQ/client/cf160000-0000-4000-8000-000000000001/cf190000-0000-4000-8000-000000000003.pdf','[UJI] Linked.pdf',20,'cf110000-0000-4000-8000-000000000004'),
 ('cf190000-0000-4000-8000-000000000004','DOCQ','calibration','cf180000-0000-4000-8000-000000000001','certificate','DOCQ/calibration/cf180000-0000-4000-8000-000000000001/cf190000-0000-4000-8000-000000000004.pdf','[UJI] Calibration.pdf',20,'cf110000-0000-4000-8000-000000000004');
insert into public.renewal_communications(certificate_id,client_id,branch_code,kind,stage,pic_name,channel,note,document_id,created_by)
 values('cf160000-0000-4000-8000-000000000001','cf150000-0000-4000-8000-000000000001','DOCQ','status','offered','[UJI] PIC','email','[UJI] Existing pipeline evidence','cf190000-0000-4000-8000-000000000003','cf110000-0000-4000-8000-000000000004');
-- Storage metadata fixture only: no real PDF or external storage write is made.
insert into storage.objects(bucket_id,name) values('certificate-documents','DOCQ/personnel/cf140000-0000-4000-8000-000000000001/cf190000-0000-4000-8000-000000000001.pdf');
set local role authenticated;
select set_config('request.jwt.claim.sub','cf110000-0000-4000-8000-000000000002',true);
select pg_temp.denied_document($q$select public.remove_operational_document('cf190000-0000-4000-8000-000000000001','DOCQ','personnel','cf140000-0000-4000-8000-000000000001')$q$,'42501');
select set_config('request.jwt.claim.sub','cf110000-0000-4000-8000-000000000003',true);
select pg_temp.denied_document($q$select public.remove_operational_document('cf190000-0000-4000-8000-000000000001','DOCQ','personnel','cf140000-0000-4000-8000-000000000001')$q$,'42501');
select set_config('request.jwt.claim.sub','cf110000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
select pg_temp.denied_document($q$select public.remove_operational_document('cf190000-0000-4000-8000-000000000001','DOCQ','personnel','cf140000-0000-4000-8000-000000000001')$q$,'42501');
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
select pg_temp.denied_document($q$select public.remove_operational_document('cf190000-0000-4000-8000-000000000003','DOCQ','client','cf160000-0000-4000-8000-000000000001')$q$,'23503');
select set_config('request.jwt.claim.sub','cf110000-0000-4000-8000-000000000001',true);
select pg_temp.check_document((public.remove_operational_document('cf190000-0000-4000-8000-000000000001','DOCQ','personnel','cf140000-0000-4000-8000-000000000001')->>'cleanup_pending')::boolean,'HRGA can detach upload');
select pg_temp.check_document(not exists(select 1 from public.operational_documents where id='cf190000-0000-4000-8000-000000000001'),'removed document is not readable');
select pg_temp.check_document(exists(select 1 from public.operational_documents where id='cf190000-0000-4000-8000-000000000002'),'same-named sibling is retained');
select pg_temp.check_document(private.document_cleanup_scope('DOCQ/personnel/cf140000-0000-4000-8000-000000000001/cf190000-0000-4000-8000-000000000001.pdf'),'deleter can retry cleanup');
select pg_temp.denied_document($q$select public.finish_document_cleanup('cf190000-0000-4000-8000-000000000001')$q$,'P0001');
select pg_temp.denied_document($q$insert into public.operational_documents(id,branch_code,domain,record_id,kind,object_path,original_name,file_bytes,created_by) values('cf190000-0000-4000-8000-000000000001','DOCQ','personnel','cf140000-0000-4000-8000-000000000001','certificate','DOCQ/personnel/cf140000-0000-4000-8000-000000000001/cf190000-0000-4000-8000-000000000001.pdf','[UJI] Restore.pdf',20,'cf110000-0000-4000-8000-000000000001')$q$,'P0001');
select public.remove_operational_document('cf190000-0000-4000-8000-000000000002','DOCQ','personnel','cf140000-0000-4000-8000-000000000001');
select public.finish_document_cleanup('cf190000-0000-4000-8000-000000000002');
select pg_temp.check_document(not (public.remove_operational_document('cf190000-0000-4000-8000-000000000002','DOCQ','personnel','cf140000-0000-4000-8000-000000000001')->>'cleanup_pending')::boolean,'completed retry is idempotent');
select pg_temp.check_document((select certificate_number='UJI-UNCHANGED' and issue_date='2025-01-01' and expiry_date='2027-01-01' from public.personnel_certificates where id='cf140000-0000-4000-8000-000000000001'),'certificate number and dates unchanged');
select set_config('request.jwt.claim.sub','cf110000-0000-4000-8000-000000000002',true);
select pg_temp.check_document(not private.document_cleanup_scope('DOCQ/personnel/cf140000-0000-4000-8000-000000000001/cf190000-0000-4000-8000-000000000001.pdf'),'reader cannot recover removed blob');
select set_config('request.jwt.claim.sub','cf110000-0000-4000-8000-000000000005',true);
select public.remove_operational_document('cf190000-0000-4000-8000-000000000004','DOCQ','calibration','cf180000-0000-4000-8000-000000000001');
reset role;
select pg_temp.check_document((select count(*)=2 from public.audit_logs where table_name='operational_documents' and action='DELETE' and record_id in ('cf190000-0000-4000-8000-000000000001','cf190000-0000-4000-8000-000000000002')),'one audit event per deletion');
select pg_temp.check_document(not exists(select 1 from private.removed_operational_documents where id='cf190000-0000-4000-8000-000000000003'),'blocked evidence removal rolls back ledger');
select pg_temp.check_document(exists(select 1 from public.operational_documents where id='cf190000-0000-4000-8000-000000000003'),'pipeline evidence retained');
select pass('Attachment removal enforces roles, branch, MFA, parent, evidence FK, audit, idempotency and private cleanup; certificates unchanged');
select * from finish();
rollback;
