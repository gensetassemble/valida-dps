-- DEVELOPMENT ONLY. Synthetic client examples requested by the user; never run automatically.
-- Labels/flags remain [CONTOH]. No PIC, email, quotation, PO or PDF evidence is invented.
begin;
update public.client_certificates set issue_date='2024-04-17',interval_months=36,expiry_date='2027-04-17'
 where id='d3410000-0000-4000-8000-000000000002' and is_example;
update public.client_certificates set issue_date='2025-12-09',interval_months=12,expiry_date='2026-12-09'
 where id='d3410000-0000-4000-8000-000000000003' and is_example;
update public.clients c set portfolio_id=p.id from public.portfolios p where c.is_example and c.branch_code='DPS' and p.branch_code='DPS'
 and p.code=case right(c.id::text,1) when '1' then 'IND' when '2' then 'IND' when '3' then 'IND' when '4' then 'HMPM' when '5' then 'KSP' when '6' then 'LAB' end
 and c.id::text like 'd3400000-0000-4000-8000-%';
update public.client_certificates cc set portfolio_id=c.portfolio_id from public.clients c where c.id=cc.client_id and c.is_example and cc.id::text like 'd3410000-0000-4000-8000-%';
insert into public.certificate_types(code,name,category,branch_code) select 'CONTOH_MVP_'||v.code,'[CONTOH] Sertifikat Layanan '||v.code,'client','DPS'
 from (values('BBR'),('PIK'),('MIN'),('HMPM'))v(code) on conflict(code) do nothing;
with scenarios(n,code,name,object_name,days,amount,area) as (values
 (7,'BBR','[CONTOH] PT Contoh Batu Bara Sejahtera','[CONTOH] Fasilitas timbang pelabuhan',15,28000000::numeric,'Bali'),
 (8,'PIK','[CONTOH] PT Contoh Pangan Lestari','[CONTOH] Lini pengolahan pangan',-10,33000000::numeric,'NTB'),
 (9,'MIN','[CONTOH] PT Contoh Mineral Timur','[CONTOH] Fasilitas preparasi mineral',60,46000000::numeric,'NTT'),
 (10,'HMPM','[CONTOH] PT Contoh Energi Maritim','[CONTOH] Tangki timbun unit B',180,51000000::numeric,'Bali'))
insert into public.clients(id,name,work_area_id,portfolio_id,account_manager_id,branch_code,is_example,example_am_label,verification_note)
select ('d3400000-0000-4000-8000-'||lpad(s.n::text,12,'0'))::uuid,s.name,w.id,p.id,pr.id,'DPS',true,'[CONTOH] Account Manager Development','[CONTOH] Skenario fiktif untuk MVP portofolio, bukan pelanggan operasional.'
from scenarios s join public.portfolios p on p.code=s.code and p.branch_code='DPS' join public.work_areas w on w.name=s.area and w.branch_code='DPS'
join public.profiles pr on pr.email='am@valida.example.invalid' and pr.branch_code='DPS' on conflict(id) do nothing;
with scenarios(n,code,object_name,days,amount) as (values
 (7,'BBR','[CONTOH] Fasilitas timbang pelabuhan',15,28000000::numeric),(8,'PIK','[CONTOH] Lini pengolahan pangan',-10,33000000::numeric),
 (9,'MIN','[CONTOH] Fasilitas preparasi mineral',60,46000000::numeric),(10,'HMPM','[CONTOH] Tangki timbun unit B',180,51000000::numeric))
insert into public.client_certificates(id,client_id,certificate_type_id,certificate_number,object_type,object_serial,installation_location,issue_date,interval_months,expiry_date,previous_order_value,order_reference,portfolio_id,branch_code,verification_status,verification_note,is_example,notes)
select ('d3410000-0000-4000-8000-'||lpad(s.n::text,12,'0'))::uuid,c.id,t.id,'[CONTOH] DPS/MVP/'||s.code||'/'||lpad(s.n::text,4,'0'),s.object_name,'CONTOH-MVP-'||s.n,'[CONTOH] Lokasi simulasi '||s.code,
 ((now() at time zone 'Asia/Makassar')::date+s.days-interval '12 months')::date,12,(now() at time zone 'Asia/Makassar')::date+s.days,s.amount,'[CONTOH] SPK-MVP/'||s.n,c.portfolio_id,'DPS','verified','[CONTOH] Status simulasi tampilan, bukan verifikasi dokumen nyata.',true,
 '[CONTOH] Nilai, objek dan tanggal fiktif. Bukan peluang riil. Contoh H+180 tidak masuk pipeline sampai H-90 kecuali dibuka sebagai aktivitas.'
from scenarios s join public.clients c on c.id=('d3400000-0000-4000-8000-'||lpad(s.n::text,12,'0'))::uuid join public.certificate_types t on t.code='CONTOH_MVP_'||s.code and t.branch_code='DPS' on conflict(id) do nothing;
commit;
