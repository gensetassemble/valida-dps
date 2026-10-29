-- Synthetic identities and records exist only inside this rolled-back transaction.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
create function pg_temp.assert_true(v boolean,label text) returns void language plpgsql as $$
begin if v is distinct from true then raise exception 'FAIL: %',label; end if; end $$;

create function pg_temp.followup(cert uuid,target text,note text,doc uuid default null) returns uuid language plpgsql as $$
declare details jsonb;pic public.client_contacts;
begin
 select x.* into pic from public.client_contacts x join public.client_certificates c on c.client_id=x.client_id where c.id=cert limit 1;
 details:=jsonb_build_object('pic_name',coalesce(pic.name,'[CONTOH] PIC'),'channel','phone','confirmed',true,'document_number','[CONTOH] Document','document_date',(now() at time zone 'Asia/Makassar')::date,'follow_up_date',(now() at time zone 'Asia/Makassar')::date+7,'reason','[CONTOH] Explicit closure reason');
 if pic.id is not null then details:=details||jsonb_build_object('contact_id',pic.id);end if;
 return public.record_renewal_followup(cert,target,note,details,doc);
end $$;

insert into public.branches(code,name) values('TEST','[CONTOH] Cabang Uji');
insert into public.work_areas(id,name,branch_code) values('80000000-0000-4000-8000-000000000001','[CONTOH] Wilayah Cabang Lain','TEST');
insert into public.portfolios(id,code,name,branch_code) values
 ('40000000-0000-4000-8000-000000000001','UJI_P1','[CONTOH] Portofolio Satu','DPS'),
 ('40000000-0000-4000-8000-000000000002','UJI_P2','[CONTOH] Portofolio Dua','DPS');
insert into auth.users(id) select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,11)n;
insert into public.employee_directory(id,full_name,npp,branch_code,employment_status,verification_status,is_active)
 select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'[CONTOH] Pegawai Uji '||n,lpad(n::text,6,'0'),case when n=11 then 'TEST' else 'DPS' end,'active','verified',true from generate_series(1,12)n;
insert into public.profiles(id,employee_id,branch_code,is_active,activated_at,full_name)
 select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case when n=11 then 'TEST' else 'DPS' end,n<>10,case when n<>10 then now() end,'[CONTOH] Akun Uji '||n from generate_series(1,11)n;
insert into public.user_role_assignments(profile_id,role_code,branch_code,grant_reason)
 select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 (array['admin','account_manager','account_manager','hrga','coordinator','qshe','equipment_manager','inspector','branch_head','admin','admin'])[n],
 case when n=11 then 'TEST' else 'DPS' end,'[CONTOH] Penugasan pengujian RLS.' from generate_series(1,11)n;
insert into public.user_role_assignments(profile_id,role_code,branch_code,grant_reason)
 values('20000000-0000-4000-8000-000000000005','inspector','DPS','[CONTOH] Peran tambahan terotorisasi.');
insert into public.employee_portfolio_assignments(employee_id,portfolio_id,assignment_type,verification_status)
 values
 ('30000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000001','coordinator','verified'),
 ('30000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000001','qshe','verified'),
 ('30000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000001','equipment_responsible','verified'),
 ('30000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000001','personnel','verified'),
 ('30000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000002','personnel','verified'),
 ('30000000-0000-4000-8000-000000000012','40000000-0000-4000-8000-000000000002','personnel','verified');
insert into public.clients(id,name,account_manager_id,portfolio_id) values
 ('50000000-0000-4000-8000-000000000001','[CONTOH] Klien A','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001'),
 ('50000000-0000-4000-8000-000000000002','[CONTOH] Klien B','20000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000002');
insert into public.clients(id,name,branch_code) values ('50000000-0000-4000-8000-000000000003','[CONTOH] Klien Cabang Lain','TEST');
insert into public.client_contacts(client_id,name) values('50000000-0000-4000-8000-000000000001','[CONTOH] Kontak A');
insert into public.client_certificates(id,client_id,certificate_type_id,certificate_number)
 select '60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',id,'000001/CONTOH' from public.certificate_types where code='CONTOH_KLIEN' and branch_code='DPS';
insert into public.personnel_certificates(employee_id,certificate_type_id)
 select e,id from public.certificate_types cross join unnest(array['30000000-0000-4000-8000-000000000008'::uuid,'30000000-0000-4000-8000-000000000012'::uuid])e where code='CONTOH_PERSONEL' and branch_code='DPS';
insert into public.equipment(id,name,ownership,portfolio_id) values
 ('70000000-0000-4000-8000-000000000001','[CONTOH] Peralatan P1','internal','40000000-0000-4000-8000-000000000001'),
 ('70000000-0000-4000-8000-000000000002','[CONTOH] Peralatan P2','internal','40000000-0000-4000-8000-000000000002');
insert into public.calibrations(equipment_id) values('70000000-0000-4000-8000-000000000001'),('70000000-0000-4000-8000-000000000002');
insert into storage.objects(bucket_id,name) values('certificate-documents','phase02-metadata-only.pdf');

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
create temporary table checks(k text primary key,v text);
insert into checks values('batch',public.stage_import('DPS','employees','CONTOH.csv',repeat('a',64),100,
 '[{"sheet":"Data","row":2,"raw":{"NRK":"09876","NAMA":"[CONTOH] Impor"},"normalized":{"npp":"09876","full_name":"[CONTOH] Impor","employment_category":"PT","organization_unit":"DPS"},"issues":[],"status":"ready"}]','[CONTOH] Suite transaksi, bukan sumber perusahaan.')::text);
select pg_temp.assert_true(public.stage_import('DPS','employees','CONTOH.csv',repeat('a',64),100,
 '[{"sheet":"Data","row":2,"raw":{},"normalized":{},"issues":[],"status":"ready"}]','[CONTOH] Ulang')::text=(select v from checks where k='batch'),'file upload is idempotent');
select pg_temp.assert_true((select count(*)=1 from public.import_rows where batch_id=(select v::uuid from checks where k='batch')),'one source row staged once');
insert into checks select 'row',id::text from public.import_rows where batch_id=(select v::uuid from checks where k='batch');
select public.review_import((select v::uuid from checks where k='row'),'{"npp":"09876","full_name":"[CONTOH] Impor","employment_category":"PT","organization_unit":"DPS"}',true,'[CONTOH] Persetujuan eksplisit reviewer uji.');
select pg_temp.assert_true(public.commit_import((select v::uuid from checks where k='batch'))=1,'approved row creates actual directory record');
select pg_temp.assert_true(public.commit_import((select v::uuid from checks where k='batch'))=0,'commit is idempotent');
select pg_temp.assert_true(exists(select 1 from public.employee_directory e where e.npp='09876' and not e.is_active and e.verification_status='pending' and not exists(select 1 from public.profiles p where p.employee_id=e.id)),'directory import preserves leading zeroes and creates no login/profile');

-- Direct privileged metadata and branch writes remain unavailable to app callers.
do $$ begin
 begin update public.import_rows set decision='approved';raise exception 'FAIL: direct staging update';exception when insufficient_privilege then null;end;
 begin update public.renewal_opportunities set stage='po_received';raise exception 'FAIL: direct kanban bypass';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000008',true);
select pg_temp.assert_true((select count(*)=0 from public.import_rows),'inspector cannot read private staging');
do $$ begin
 begin perform public.commit_import((select v::uuid from checks where k='batch'));raise exception 'FAIL: inspector import';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000004',true);
select pg_temp.assert_true((select count(*)=0 from public.import_batches),'HRGA is not an import administrator');
do $$ begin
 begin perform public.stage_import('DPS','employees','x.csv',repeat('b',64),10,'[]','test');raise exception 'FAIL: HRGA staging';exception when insufficient_privilege then null;end;
end $$;

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
-- A conflicting approved batch rolls back ALL its canonical mutations.
insert into checks values('conflict',public.stage_import('DPS','employees','CONTOH-CONFLICT.csv',repeat('c',64),100,
 '[{"sheet":"Data","row":2,"raw":{},"normalized":{"npp":"09877","full_name":"[CONTOH] Must Roll Back","employment_category":"PT"},"issues":[],"status":"ready"},{"sheet":"Data","row":3,"raw":{},"normalized":{"npp":"09876","full_name":"[CONTOH] Different Identity","employment_category":"PT"},"issues":[],"status":"conflict"}]','[CONTOH] Atomicity')::text);
select public.review_import(id,normalized_values,true,'[CONTOH] Persetujuan untuk uji transaksi konflik.') from public.import_rows where batch_id=(select v::uuid from checks where k='conflict');
do $$ begin
 begin perform public.commit_import((select v::uuid from checks where k='conflict'));raise exception 'FAIL: conflicting identity imported';exception when raise_exception then if sqlerrm not like 'Konflik NRK%' then raise;end if;end;
end $$;
select pg_temp.assert_true(not exists(select 1 from public.employee_directory where npp='09877'),'batch canonical writes roll back on conflict');
select pg_temp.assert_true((select count(*)=2 from public.import_rows where batch_id=(select v::uuid from checks where k='conflict') and decision='approved'),'failed batch remains reviewable');

-- Four distinct lifetime certificates and two independent license records.
insert into checks values('lifetime_baseline',coalesce(public.operational_summary('DPS','{"category":"personnel"}')->'buckets'->>'Berlaku Seumur Hidup','0'));
insert into public.personnel_certificates(employee_id,certificate_type_id,original_title,validity_kind,verification_status)
 select '30000000-0000-4000-8000-000000000008',t.id,'[CONTOH] Lifetime '||n,'lifetime','verified' from public.certificate_types t cross join generate_series(1,4)n where t.code='CONTOH_PERSONEL' and t.branch_code='DPS';
insert into public.personnel_certificates(employee_id,certificate_type_id,original_title,expiry_date,verification_status)
 select '30000000-0000-4000-8000-000000000008',t.id,title,(now() at time zone 'Asia/Makassar')::date+30,'verified' from public.certificate_types t cross join unnest(array['[CONTOH] Liquid Cargo','[CONTOH] Draught Survey']) title where t.code='CONTOH_PERSONEL' and t.branch_code='DPS';
select pg_temp.assert_true((select count(*)=4 from public.personnel_certificate_records where employee_id='30000000-0000-4000-8000-000000000008' and validity_kind='lifetime' and expiry_date is null and interval_months is null and validity_status='Berlaku Seumur Hidup'),'lifetime classification is per record with null expiry/interval');
select pg_temp.assert_true((select count(*)=2 from public.personnel_certificate_records where original_title in('[CONTOH] Liquid Cargo','[CONTOH] Draught Survey')),'two titles remain separate licenses');
select pg_temp.assert_true((public.operational_summary('DPS','{"category":"personnel"}')->'buckets'->>'Berlaku Seumur Hidup')::integer=(select v::integer+4 from checks where k='lifetime_baseline'),'lifetime has its own dashboard bucket');
select pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(public.operational_summary('DPS','{"category":"personnel"}')->'soon') item where item->>'validity_status'='Berlaku Seumur Hidup'),'lifetime excluded from expiry summaries');
do $$ begin
 begin insert into public.personnel_certificates(employee_id,certificate_type_id,validity_kind,expiry_date) select '30000000-0000-4000-8000-000000000008',id,'lifetime','2030-01-01' from public.certificate_types where code='CONTOH_PERSONEL';raise exception 'FAIL: lifetime expiry';exception when check_violation then null;end;
end $$;

update public.equipment set verification_status='verified' where id='70000000-0000-4000-8000-000000000001';
insert into public.calibrations(id,equipment_id,calibration_date,due_date,result,verification_status,date_basis,date_source)
 values('71000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Makassar')::date-1,(now() at time zone 'Asia/Makassar')::date+120,'layak','verified','certificate','[CONTOH] Dokumen uji');
select pg_temp.assert_true((select eligibility_status='Layak Pakai' from public.equipment_records where id='70000000-0000-4000-8000-000000000001'),'verified result and due date clear asset');
insert into public.calibrations(id,equipment_id,calibration_date,due_date,verification_status)
 values('71000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Makassar')::date,(now() at time zone 'Asia/Makassar')::date+120,'pending');
select pg_temp.assert_true((select eligibility_status='Hasil Belum Diisi' from public.equipment_records where id='70000000-0000-4000-8000-000000000001'),'newer calibration with missing result cannot clear asset');
update public.calibrations set result='tidak_layak' where id='71000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select eligibility_status='Tidak Layak Pakai' from public.equipment_records where id='70000000-0000-4000-8000-000000000001'),'known failed verified result blocks asset even with pending latest event');
insert into public.calibrations(equipment_id,calibration_date,interval_months,calculation_base)
 values('70000000-0000-4000-8000-000000000002','2024-01-31',1,'calibration_date');
select pg_temp.assert_true(exists(select 1 from public.calibrations where equipment_id='70000000-0000-4000-8000-000000000002' and calculated_due_date='2024-02-29'),'calendar-month arithmetic handles leap year');
do $$ begin
 begin insert into public.calibrations(equipment_id,verification_status,due_date,date_basis,date_source) values('70000000-0000-4000-8000-000000000002','verified','2030-01-01','certificate','[CONTOH]');raise exception 'FAIL: unknown result verified';exception when check_violation then null;end;
end $$;

-- Gate-protected commercial flow; a card cannot jump straight to PO.
do $$ begin
 begin perform pg_temp.followup('60000000-0000-4000-8000-000000000001','po_received','[CONTOH] Bypass test',null);raise exception 'FAIL: kanban jump';exception when raise_exception then if sqlerrm not like 'Transisi ditolak%' then raise;end if;end;
 begin perform pg_temp.followup('60000000-0000-4000-8000-000000000001','contacted','[CONTOH] Contact test',null);raise exception 'FAIL: unverified PIC';exception when raise_exception then if sqlerrm not like 'Select verified%' then raise;end if;end;
end $$;
update public.client_contacts set is_primary=true,verification_status='verified' where client_id='50000000-0000-4000-8000-000000000001';
select pg_temp.followup('60000000-0000-4000-8000-000000000001','contacted','[CONTOH] Kontak telah dicatat oleh penguji.',null);
do $$ begin
 begin perform pg_temp.followup('60000000-0000-4000-8000-000000000001','offered','[CONTOH] Tidak ada PDF',null);raise exception 'FAIL: no quotation PDF';exception when raise_exception then if sqlerrm not like 'PDF penawaran%' then raise;end if;end;
 begin update public.client_certificates set previous_certificate_id=id where id='60000000-0000-4000-8000-000000000001';raise exception 'FAIL: self history';exception when check_violation then null;end;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000009',true);
do $$ begin begin insert into public.personnel_correction_requests(certificate_id,branch_code,message) select id,'DPS','[CONTOH] Head may not mutate.' from public.personnel_certificates where employee_id='30000000-0000-4000-8000-000000000008' limit 1;raise exception 'FAIL: head correction write';exception when insufficient_privilege then null;end;end $$;
do $$ begin
 begin perform pg_temp.followup('60000000-0000-4000-8000-000000000001','deferred','[CONTOH] Head writes',null);raise exception 'FAIL: head kanban mutation';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true((select count(*)=1 from public.client_certificate_records),'read models preserve AM isolation');
select pg_temp.assert_true((select count(*)=0 from public.import_rows),'AM cannot read staging');
select pg_temp.assert_true(not has_table_privilege(current_user,'public.operational_documents','DELETE'),'document metadata cannot be deleted by app');

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
do $$ begin
 begin update public.client_certificates set is_example=true where id='60000000-0000-4000-8000-000000000001';raise exception 'FAIL: example flag spoofing';exception when insufficient_privilege then null;end;
 begin insert into public.personnel_certificates(employee_id,certificate_type_id,source_import_row_id) select '30000000-0000-4000-8000-000000000008',id,(select v::uuid from checks where k='row') from public.certificate_types where code='CONTOH_PERSONEL';raise exception 'FAIL: source provenance spoofing';exception when insufficient_privilege then null;end;
end $$;
insert into public.operational_documents(id,branch_code,domain,record_id,kind,object_path,original_name,file_bytes,created_by)
 values('72000000-0000-4000-8000-000000000001','DPS','client','60000000-0000-4000-8000-000000000001','quotation','DPS/client/60000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000001.pdf','[CONTOH] metadata-only-quotation.pdf',100,auth.uid()),
 ('72000000-0000-4000-8000-000000000002','DPS','client','60000000-0000-4000-8000-000000000001','purchase_order','DPS/client/60000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000002.pdf','[CONTOH] metadata-only-po.pdf',100,auth.uid());
-- Metadata-only RLS fixtures, not actual PDFs or evidence uploads. All rows roll back.
insert into storage.objects(bucket_id,name) values
 ('certificate-documents','DPS/client/60000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000001.pdf'),
 ('certificate-documents','DPS/client/60000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000002.pdf');
select pg_temp.followup('60000000-0000-4000-8000-000000000001','offered','[CONTOH] Gate accepts matching quotation metadata.','72000000-0000-4000-8000-000000000001');
select pg_temp.followup('60000000-0000-4000-8000-000000000001','po_received','[CONTOH] Gate accepts matching PO metadata.','72000000-0000-4000-8000-000000000002');
select pg_temp.assert_true((select count(*)=3 from public.renewal_events where opportunity_id=(select id from public.renewal_opportunities where certificate_id='60000000-0000-4000-8000-000000000001')),'valid gated transitions append three immutable events');

-- Separate logging cannot advance status; failed initial calibration cannot leave an orphan asset.
do $$ declare eid uuid;before_count integer;begin
 select count(*) into before_count from public.equipment;
 begin perform public.create_equipment_with_calibration('DPS',jsonb_build_object('name','[CONTOH] Atomic invalid asset','portfolio_id','40000000-0000-4000-8000-000000000001'),'{"calibration_date":"2026-10-20","due_date":"2026-10-19"}');raise exception 'FAIL: invalid calibration accepted';exception when check_violation then null;end;
 perform pg_temp.assert_true((select count(*)=before_count from public.equipment),'invalid initial event rolls back asset');
 eid:=public.create_equipment_with_calibration('DPS',jsonb_build_object('name','[CONTOH] Atomic asset','portfolio_id','40000000-0000-4000-8000-000000000001','color','Silver'),'{"calibration_date":"2026-10-20","due_date":"2027-10-20","certificate_number":"[CONTOH] INIT","correction_factor":"0\n4\n26"}');
 perform pg_temp.assert_true(exists(select 1 from public.equipment_monitoring_records where id=eid and monitoring_certificate='[CONTOH] INIT' and latest_calibration_date='2026-10-20' and latest_due_date='2027-10-20' and color='Silver' and correction_factor=E'0\n4\n26' and ownership='internal'),'atomic create exposes all monitoring fields');
 begin perform public.create_equipment_with_calibration('DPS','{"name":"[CONTOH] Spoofed asset","verification_status":"verified"}',null);raise exception 'FAIL: privileged field injection';exception when raise_exception then if sqlerrm not like 'Unexpected asset field%' then raise;end if;end;
 begin perform public.transition_renewal('60000000-0000-4000-8000-000000000001','deferred','[CONTOH] Old API bypass',null);raise exception 'FAIL: old gate API allowed';exception when insufficient_privilege then null;end;
end $$;
select public.record_renewal_followup('60000000-0000-4000-8000-000000000001',null,'[CONTOH] Log only, no stage change.','{"pic_name":"[CONTOH] PIC","channel":"phone"}',null);
select pg_temp.assert_true((select stage='po_received' from public.renewal_opportunities where certificate_id='60000000-0000-4000-8000-000000000001'),'logging does not move a closed card');
select pg_temp.assert_true((select count(*)=1 from public.renewal_communications where kind='log' and certificate_id='60000000-0000-4000-8000-000000000001'),'separate log is persisted');
select pg_temp.assert_true(not has_table_privilege(current_user,'public.renewal_communications','UPDATE') and not has_table_privilege(current_user,'public.renewal_communications','DELETE'),'logs are immutable for callers');

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_true((select count(*)=0 from public.renewal_communications where certificate_id='60000000-0000-4000-8000-000000000001'),'other AM cannot read contact logs');
select pg_temp.assert_true((select count(*)=0 from public.operational_documents where record_id='60000000-0000-4000-8000-000000000001'),'other AM cannot read private document metadata');
select pg_temp.assert_true((select count(*)=0 from storage.objects where name like 'DPS/client/60000000-0000-4000-8000-000000000001/%'),'other AM cannot download certificate objects');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000008',true);
insert into public.personnel_correction_requests(certificate_id,branch_code,message)
 select id,'DPS','[CONTOH] Inspector may propose own correction.' from public.personnel_certificates where employee_id='30000000-0000-4000-8000-000000000008' limit 1;
select pg_temp.assert_true((select count(*)=1 from public.personnel_correction_requests where created_by=auth.uid()),'inspector proposes correction without changing official certificate');

set local role anon;
do $$ begin begin perform * from public.operational_scope_records;raise exception 'FAIL: anonymous dashboard';exception when insufficient_privilege then null;end;end $$;
reset role;
select pass('Phase 03+04: scoped read models, private staging, approval/atomic/idempotent import, lifetime, calibration eligibility and kanban gates');
select * from finish();
rollback;
