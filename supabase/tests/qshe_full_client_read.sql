begin;
create function pg_temp.qfc_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'QSHE read: %',label;end if;end $$;
insert into public.branches(code,name) values('QFCR','[UJI] QSHE full read'),('QFOT','[UJI] Other branch');
insert into auth.users(id) values('df110000-0000-4000-8000-000000000001'),('df110000-0000-4000-8000-000000000002');
insert into public.profiles(id,branch_code,full_name,is_active) values
 ('df110000-0000-4000-8000-000000000001','QFCR','[UJI] Fresh QSHE 1',true),
 ('df110000-0000-4000-8000-000000000002','QFCR','[UJI] Fresh QSHE 2',true);
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason)
 select id,branch_code,'qshe','[UJI] Read every branch client' from public.profiles where id::text like 'df110000-%';
insert into public.portfolios(id,branch_code,code,name) values('df120000-0000-4000-8000-000000000001','QFCR','A','[UJI] Portfolio A');
insert into public.clients(id,branch_code,name,portfolio_id) values
 ('df130000-0000-4000-8000-000000000001','QFCR','[UJI] Portfolio customer','df120000-0000-4000-8000-000000000001'),
 ('df130000-0000-4000-8000-000000000002','QFCR','[UJI] No portfolio customer',null),
 ('df130000-0000-4000-8000-000000000003','QFOT','[UJI] Outside branch customer',null);
insert into public.certificate_types(id,branch_code,code,name,category) values
 ('df140000-0000-4000-8000-000000000001','QFCR','QFC_CLIENT','[UJI] Client certificate','client'),
 ('df140000-0000-4000-8000-000000000002','QFOT','QFC_OTHER','[UJI] Outside certificate','client');
insert into public.client_certificates(id,branch_code,client_id,certificate_type_id,certificate_number,issue_date,expiry_date,is_active) values
 ('df150000-0000-4000-8000-000000000001','QFCR','df130000-0000-4000-8000-000000000001','df140000-0000-4000-8000-000000000001','[UJI] CERT A','2026-01-01','2027-01-01',true),
 ('df150000-0000-4000-8000-000000000002','QFCR','df130000-0000-4000-8000-000000000002','df140000-0000-4000-8000-000000000001','[UJI] CERT B','2026-01-01','2027-01-01',true),
 ('df150000-0000-4000-8000-000000000003','QFCR','df130000-0000-4000-8000-000000000002','df140000-0000-4000-8000-000000000001','[UJI] INACTIVE','2026-01-01','2027-01-01',false),
 ('df150000-0000-4000-8000-000000000004','QFOT','df130000-0000-4000-8000-000000000003','df140000-0000-4000-8000-000000000002','[UJI] OUTSIDE','2026-01-01','2027-01-01',true);
insert into public.client_contacts(branch_code,client_id,name) values('QFCR','df130000-0000-4000-8000-000000000002','[UJI] Contact');
insert into public.service_types(branch_code,code,name) values('QFCR','TEST','[UJI] Service'),('QFOT','OUT','[UJI] Outside service');
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
select set_config('request.jwt.claim.sub','df110000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.qfc_assert((select count(*)=2 from public.clients),'reads all own branch customers without portfolio assignments');
select pg_temp.qfc_assert((select count(*)=3 from public.client_certificates),'reads all active and inactive certificates');
select pg_temp.qfc_assert((select count(*)=3 from public.client_certificate_display_records),'UI and export view follow full read scope');
select pg_temp.qfc_assert((select count(*)=2 from public.client_directory_records),'customer directory follows full read scope');
select pg_temp.qfc_assert((select count(*)=1 from public.client_contacts),'customer contacts visible');
select pg_temp.qfc_assert((select count(*)=1 from public.service_types),'service catalog reads only own branch');
select pg_temp.qfc_assert(private.document_scope('QFCR','client','df150000-0000-4000-8000-000000000002',false),'certificate attachments can be read');
select pg_temp.qfc_assert(not private.document_scope('QFCR','client','df150000-0000-4000-8000-000000000002',true),'attachment writes remain blocked');
select pg_temp.qfc_assert(not private.client_scope('QFCR','df130000-0000-4000-8000-000000000002',true),'client writes remain blocked');
do $$ declare changed integer;begin
 update public.clients set name='Forbidden' where branch_code='QFCR';get diagnostics changed=row_count;
 perform pg_temp.qfc_assert(changed=0,'cannot edit clients');
 update public.client_certificates set certificate_number='Forbidden' where branch_code='QFCR';get diagnostics changed=row_count;
 perform pg_temp.qfc_assert(changed=0,'cannot edit certificates');
 begin
  delete from public.client_certificates where branch_code='QFCR';get diagnostics changed=row_count;
 exception when insufficient_privilege then changed:=0;
 end;
 perform pg_temp.qfc_assert(changed=0,'cannot delete certificates');
end $$;
select set_config('request.jwt.claim.sub','df110000-0000-4000-8000-000000000002',true);
select pg_temp.qfc_assert((select count(*)=3 from public.client_certificates),'second new QSHE inherits same read access');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.user_role_assignments set is_active=false where profile_id='df110000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','df110000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.qfc_assert((select count(*)=0 from public.client_certificates),'revoking the role removes access immediately');
reset role;
select 'PASS: QSHE all branch customers/certificates/contacts/catalog/attachments; fresh accounts; no mutation, deletion or cross-branch access; revocation enforced' result;
rollback;
