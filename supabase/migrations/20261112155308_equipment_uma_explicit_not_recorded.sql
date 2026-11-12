-- Preserve explicit N/A dates from UMA instead of recalculating them.
create or replace function public.sync_equipment_uma(b text, filename text, filehash text, items jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 r jsonb;a jsonb;c jsonb;k text;p uuid;ids uuid[];eid uuid;cid uuid;
 e public.equipment;ne public.equipment;ev public.calibrations;nv public.calibrations;
 runid uuid;outcomes jsonb:='[]';action text;ca text;loc text;
 seen text[]:='{}'; matches uuid[];same_cert text;current_event uuid;problems text[]:='{}';source_key text;
begin
 if auth.uid() is null or not private.has_role(b,array['admin','equipment_manager','coordinator']) then
  raise exception 'Impor memerlukan Admin, PTK, atau Koordinator berwenang.' using errcode='42501';end if;
 if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) not between 1 and 1000
  or octet_length(items::text)>6000000 or length(filename) not between 1 and 180 or filehash !~ '^[a-f0-9]{64}$'
  then raise exception 'Format atau ukuran impor tidak valid.';end if;
 -- Serialize uploads per branch; matching is re-evaluated inside this transaction.
 perform pg_advisory_xact_lock(hashtextextended('equipment-uma:'||b,0));
 insert into public.equipment_sync_runs(branch_code,source_name,source_hash,source_rows)
 values(b,filename,filehash,items) returning id into runid;
 for r in select value from jsonb_array_elements(items) loop
  loc:=coalesce(r->>'sheet','Data')||' baris '||coalesce(r->>'row','?');
  begin
   a:=r->'asset';c:=r->'calibration';
   if jsonb_typeof(a) is distinct from 'object' or jsonb_typeof(c) is distinct from 'object'
    or length(trim(coalesce(r->>'name',''))) not between 2 and 200 or length(trim(coalesce(r->>'tag',''))) not between 1 and 200
    then raise exception 'Nama, tag, dan parameter UMA tidak valid.';end if;
   for k in select jsonb_object_keys(a) loop
    if not k=any(array['serial','brand','model','color','specification_size','item_condition','item_status','unit','location','notes','measurement_range','measurement_ranges']) then raise exception 'Kolom alat tidak diizinkan.';end if;
   end loop;
   for k in select jsonb_object_keys(c) loop
    if not k=any(array['laboratory','certificate_number','issue_date','calibration_date','due_date','interval_months','notes','calibration_internal','calibration_external','significant_yes','significant_no','monitoring_measurements','correction_factor','result']) then raise exception 'Kolom kalibrasi tidak diizinkan.';end if;
   end loop;
   select array_agg(id) into ids from public.portfolios where branch_code=b and is_active and upper(code)=upper(r->>'portfolio') and upper(code) not in ('UP BENETE','UP LOMBOK','CONTOH_WORKFLOW');
   if cardinality(ids) is distinct from 1 then raise exception 'Portofolio tidak ditemukan atau tidak dapat diakses.';end if;p:=ids[1];
   select array_agg(id) into ids from public.equipment where branch_code=b and portfolio_id=p
    and regexp_replace(lower(tag),'[^a-z0-9]','','g')=regexp_replace(lower(r->>'tag'),'[^a-z0-9]','','g')
    and regexp_replace(lower(name),'[^a-z0-9]','','g')=regexp_replace(lower(r->>'name'),'[^a-z0-9]','','g');
   if cardinality(ids)>1 and nullif(r->>'serial','') is not null then
    select array_agg(id) into ids from public.equipment where id=any(ids)
     and regexp_replace(lower(serial),'[^a-z0-9]','','g')=regexp_replace(lower(r->>'serial'),'[^a-z0-9]','','g');
   end if;
   if cardinality(ids)>1 then raise exception 'Lebih dari satu alat cocok. Periksa nomor seri dan identitas alat.';end if;
   if coalesce(cardinality(ids),0)=0 then
    if exists(select 1 from public.equipment where branch_code=b and portfolio_id=p and regexp_replace(lower(tag),'[^a-z0-9]','','g')=regexp_replace(lower(r->>'tag'),'[^a-z0-9]','','g')) then
     raise exception 'Tag sudah dipakai alat lain. Samakan nama/serial atau periksa direktori terlebih dahulu.';end if;
    ne:=jsonb_populate_record(null::public.equipment,a||jsonb_build_object('name',r->>'name','tag',r->>'tag'));
    insert into public.equipment(branch_code,portfolio_id,name,tag,serial,brand,model,color,specification_size,item_condition,item_status,unit,location,notes,measurement_range,measurement_ranges)
     values(b,p,ne.name,ne.tag,ne.serial,ne.brand,ne.model,ne.color,ne.specification_size,ne.item_condition,ne.item_status,ne.unit,ne.location,ne.notes,ne.measurement_range,ne.measurement_ranges) returning * into e;
    eid:=e.id;action:='added';
   else
    eid:=ids[1];select * into e from public.equipment where id=eid and branch_code=b for update;
    if not e.is_active then raise exception 'Alat berada di Arsip. Pulihkan melalui direktori sebelum mengimpor.';end if;
    if not private.equipment_scope(b,eid,true) then raise exception 'Alat di luar kewenangan portofolio Anda.' using errcode='42501';end if;
    if nullif(r->>'serial','') is not null and nullif(e.serial,'') is not null and lower(e.serial) not in ('n/a','-')
     and regexp_replace(lower(e.serial),'[^a-z0-9]','','g')<>regexp_replace(lower(r->>'serial'),'[^a-z0-9]','','g') then
     raise exception 'Nomor seri berbeda. Periksa identitas alat; tidak dibuat duplikat.';end if;
    ne:=jsonb_populate_record(e,a);action:='unchanged';
    if to_jsonb(ne) is distinct from to_jsonb(e) then
     update public.equipment set serial=ne.serial,brand=ne.brand,model=ne.model,color=ne.color,specification_size=ne.specification_size,
      item_condition=ne.item_condition,item_status=ne.item_status,unit=ne.unit,location=ne.location,notes=ne.notes,
      measurement_range=ne.measurement_range,measurement_ranges=ne.measurement_ranges where id=eid;
     action:='updated';end if;
   end if;
   source_key:=eid::text||':'||lower(coalesce(nullif(c->>'certificate_number',''),c->>'issue_date','latest'));
   if source_key=any(seen) then raise exception 'Alat dan peristiwa yang sama berulang dalam file.';end if;seen:=array_append(seen,source_key);
   ca:='none';cid:=null;current_event:=null;
   select id into current_event from public.calibrations where equipment_id=eid and branch_code=b and is_active
    order by coalesce(issue_date,calibration_date) desc nulls last,created_at desc,id desc limit 1;
   same_cert:=nullif(trim(c->>'certificate_number'),'');
   if same_cert is not null then
    select array_agg(id) into matches from public.calibrations where equipment_id=eid and branch_code=b and is_active
     and lower(trim(certificate_number))=lower(same_cert);
    if cardinality(matches)>1 then raise exception 'Nomor sertifikat cocok ke beberapa peristiwa. Periksa riwayat terlebih dahulu.';end if;
    cid:=matches[1];
    if cid is not null and current_event is not null and cid<>current_event
     and (select coalesce(issue_date,calibration_date) from public.calibrations where id=cid) is distinct from (select coalesce(issue_date,calibration_date) from public.calibrations where id=current_event)
     then raise exception 'File menunjuk sertifikat historis. Gunakan data monitoring terbaru.';end if;
   elsif nullif(c->>'issue_date','') is not null then
    select array_agg(id) into matches from public.calibrations where equipment_id=eid and branch_code=b and is_active
     and coalesce(issue_date,calibration_date)=(c->>'issue_date')::date;
    if cardinality(matches)>1 then raise exception 'Tanggal cocok ke beberapa peristiwa. Isi nomor sertifikat.';end if;
    cid:=matches[1];
    if cid is not null and cid<>current_event then raise exception 'File menunjuk tanggal peristiwa historis.';end if;
   else cid:=current_event;end if;
   if cid is null and (same_cert is not null or nullif(c->>'issue_date','') is not null) then
    if nullif(c->>'issue_date','') is null then raise exception 'Sertifikat baru memerlukan tanggal terbit sertifikat.';end if;
    if current_event is not null and (select coalesce(issue_date,calibration_date) from public.calibrations where id=current_event)>(c->>'issue_date')::date then raise exception 'Tanggal sertifikat baru lebih lama dari peristiwa terbaru.';end if;
    nv:=jsonb_populate_record(null::public.calibrations,c);
    insert into public.calibrations(equipment_id,branch_code,laboratory,certificate_number,issue_date,calibration_date,due_date,reported_due_date,interval_months,calculation_base,date_basis,date_source,result,notes,calibration_internal,calibration_external,significant_yes,significant_no,monitoring_measurements,correction_factor)
     values(eid,b,nv.laboratory,nv.certificate_number,nv.issue_date,nv.issue_date,nv.due_date,nv.due_date,nv.interval_months,case when c?'due_date' and c->'due_date'='null'::jsonb then null else 'issue_date' end,'unverified','Impor monitoring UMA',coalesce(nv.result,'layak'),nv.notes,nv.calibration_internal,nv.calibration_external,nv.significant_yes,nv.significant_no,nv.monitoring_measurements,nv.correction_factor) returning id into cid;
    ca:='added';
   elsif cid is not null then
    select * into ev from public.calibrations where id=cid and branch_code=b for update;
    nv:=jsonb_populate_record(ev,c);
    if c?'issue_date' then nv.calibration_date:=nv.issue_date;end if;
    if c?'due_date' then nv.reported_due_date:=nv.due_date;if c->'due_date'='null'::jsonb then nv.calculation_base:=null;end if;end if;
    if (c?'issue_date' or c?'interval_months') and not c?'due_date' then
     nv.due_date:=case when nv.issue_date is not null and nv.interval_months is not null then (nv.issue_date+make_interval(months=>nv.interval_months))::date else nv.due_date end;
     nv.reported_due_date:=nv.due_date;end if;
    if to_jsonb(nv) is distinct from to_jsonb(ev) then
     update public.calibrations set laboratory=nv.laboratory,certificate_number=nv.certificate_number,issue_date=nv.issue_date,calibration_date=nv.calibration_date,
      due_date=nv.due_date,reported_due_date=nv.reported_due_date,calculation_base=nv.calculation_base,interval_months=nv.interval_months,notes=nv.notes,result=nv.result,
      calibration_internal=nv.calibration_internal,calibration_external=nv.calibration_external,significant_yes=nv.significant_yes,significant_no=nv.significant_no,
      monitoring_measurements=nv.monitoring_measurements,correction_factor=nv.correction_factor,
      verification_status=case when c-'notes'<>'{}'::jsonb then 'pending' else ev.verification_status end where id=cid;
     ca:='updated';end if;
   end if;
   outcomes:=outcomes||jsonb_build_array(jsonb_build_object('sheet',r->>'sheet','row',r->'row','name',r->>'name','tag',r->>'tag','equipment_id',eid,'equipment',action,'calibration',ca));
  exception when others then problems:=array_append(problems,loc||': '||left(sqlerrm,350));end;
  if cardinality(problems)>=100 then exit;end if;
 end loop;
 if cardinality(problems)>0 then raise exception '%',array_to_string(problems,E'\n') using errcode='P0001';end if;
 return jsonb_build_object('run',runid,'rows',outcomes);
end $$;
