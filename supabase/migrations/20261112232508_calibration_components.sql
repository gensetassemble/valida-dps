-- One physical instrument, independently renewable valve certificates.
alter table public.calibrations add column if not exists component_label text check(length(component_label)<=100);
create or replace function private.rotameter_component(equipment_name text,certificate text) returns text
language sql immutable parallel safe set search_path='' as $$
 select case when equipment_name ~* 'rotameter' then 'Katup '||upper((regexp_match(certificate,'^\s*K\s*-\s*\d+\s*([A-Z])\s*/','i'))[1]) end
$$;
revoke all on function private.rotameter_component(text,text) from public,anon;
grant execute on function private.rotameter_component(text,text) to authenticated;
create or replace function private.assign_calibration_component() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 new.component_label:=nullif(trim(new.component_label),'');
 if new.component_label is null then
  select private.rotameter_component(e.name,new.certificate_number) into new.component_label from public.equipment e where e.id=new.equipment_id and e.branch_code=new.branch_code;
 end if;
 return new;
end$$;
create trigger assign_calibration_component before insert or update of component_label,certificate_number,equipment_id on public.calibrations for each row execute function private.assign_calibration_component();
update public.calibrations c set component_label=private.rotameter_component(e.name,c.certificate_number)
 from public.equipment e where e.id=c.equipment_id and e.branch_code=c.branch_code and e.branch_code='DPS' and c.component_label is null and private.rotameter_component(e.name,c.certificate_number) is not null;
create index calibrations_equipment_component_current_idx on public.calibrations(equipment_id,lower(trim(component_label)),issue_date desc,created_at desc) where is_active;
create view public.current_equipment_calibrations with(security_invoker=true) as
 select c.* from public.calibrations c where c.is_active and c.id=(
  select latest.id from public.calibrations latest where latest.equipment_id=c.equipment_id and latest.branch_code=c.branch_code and latest.is_active
   and coalesce(lower(trim(latest.component_label)),'')=coalesce(lower(trim(c.component_label)),'')
  order by coalesce(latest.issue_date,latest.calibration_date) desc nulls last,latest.created_at desc,latest.id desc limit 1
 );
revoke all on public.current_equipment_calibrations from public,anon;
grant select on public.current_equipment_calibrations to authenticated;
create or replace view public.equipment_records with(security_invoker=true) as  SELECT e.id,
    e.asset_id,
    e.tag,
    e.name,
    e.brand,
    e.model,
    e.serial,
    e.measurement_range,
    e.location,
    e.portfolio_id,
    e.unit,
    e.ownership,
    e.client_id,
    e.responsible_employee_id,
    e.branch_code,
    e.is_active,
    e.created_at,
    e.updated_at,
    e.created_by,
    e.updated_by,
    e.notes,
    e.verification_status,
    e.verified_at,
    e.verified_by,
    l.id AS latest_calibration_id,
    l.due_date AS latest_due_date,
        CASE
            WHEN v.result = 'tidak_layak'::text OR v.due_date < (now() AT TIME ZONE 'Asia/Makassar'::text)::date THEN 'Tidak Layak Pakai'::text
            WHEN l.id IS NULL THEN 'Belum Ada Kalibrasi'::text
            WHEN l.due_date < (now() AT TIME ZONE 'Asia/Makassar'::text)::date THEN 'Tidak Layak Pakai'::text
            WHEN l.due_date IS NULL THEN 'Tanggal Belum Diisi'::text
            WHEN l.result IS NULL THEN 'Hasil Belum Diisi'::text
            WHEN l.result = 'layak'::text THEN 'Layak Pakai'::text
            ELSE 'Tidak Layak Pakai'::text
        END AS eligibility_status,
    validity_status(l.due_date, l.verification_status) AS validity_status
   FROM equipment e
     LEFT JOIN LATERAL ( SELECT c.id,
            c.equipment_id,
            c.laboratory,
            c.certificate_number,
            c.calibration_date,
            c.issue_date,
            c.due_date,
            c.interval_months,
            c.date_basis,
            c.date_source,
            c.result,
            c.verification_status,
            c.verification_note,
            c.verified_at,
            c.verified_by,
            c.branch_code,
            c.created_at,
            c.updated_at,
            c.created_by,
            c.updated_by,
            c.reported_due_date,
            c.calculated_due_date,
            c.calculation_base,
            c.resolution_note,
            c.notes,
            c.is_active,
            c.source_import_row_id
           FROM current_equipment_calibrations c
          WHERE c.equipment_id = e.id AND c.is_active
          ORDER BY c.due_date ASC NULLS LAST, c.created_at DESC, c.id DESC
         LIMIT 1) l ON true
     LEFT JOIN LATERAL ( SELECT c.id,
            c.equipment_id,
            c.laboratory,
            c.certificate_number,
            c.calibration_date,
            c.issue_date,
            c.due_date,
            c.interval_months,
            c.date_basis,
            c.date_source,
            c.result,
            c.verification_status,
            c.verification_note,
            c.verified_at,
            c.verified_by,
            c.branch_code,
            c.created_at,
            c.updated_at,
            c.created_by,
            c.updated_by,
            c.reported_due_date,
            c.calculated_due_date,
            c.calculation_base,
            c.resolution_note,
            c.notes,
            c.is_active,
            c.source_import_row_id
           FROM current_equipment_calibrations c
          WHERE c.equipment_id = e.id AND c.is_active AND c.result IS NOT NULL
          ORDER BY (c.result = 'tidak_layak') DESC, c.due_date ASC NULLS LAST, c.created_at DESC, c.id DESC
         LIMIT 1) v ON true;
-- Append the editable component label without changing any existing view column.
do $migration$ declare definition text;begin
 definition:=pg_get_viewdef('public.calibration_monitoring_records'::regclass,true);
 execute 'create or replace view public.calibration_monitoring_records with(security_invoker=true) as select base.*, c.component_label from ('||rtrim(definition,'; '||chr(10))||') base join public.calibrations c on c.id=base.id and c.branch_code=base.branch_code';
end $migration$;
create or replace function public.sync_equipment_uma(b text, filename text, filehash text, items jsonb)
returns jsonb language plpgsql security invoker set search_path='' set statement_timeout='45s' set lock_timeout='5s' as $$
declare
 r jsonb;a jsonb;c jsonb;k text;p uuid;ids uuid[];eid uuid;cid uuid;
 e public.equipment;ne public.equipment;ev public.calibrations;nv public.calibrations;
 tag_ids uuid[];source_serial text;match_basis text;
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
    if not k=any(array['laboratory','certificate_number','issue_date','calibration_date','due_date','interval_months','notes','calibration_internal','calibration_external','significant_yes','significant_no','monitoring_measurements','correction_factor','result','component_label']) then raise exception 'Kolom kalibrasi tidak diizinkan.';end if;
   end loop;
   select array_agg(id) into ids from public.portfolios where branch_code=b and is_active and upper(code)=upper(r->>'portfolio') and upper(code) not in ('UP BENETE','UP LOMBOK','CONTOH_WORKFLOW');
   if cardinality(ids) is distinct from 1 then raise exception 'Portofolio tidak ditemukan atau tidak dapat diakses.';end if;p:=ids[1];
   -- Strong identifiers first. A name spelling difference alone must not duplicate an asset.
   select array_agg(id) into tag_ids from public.equipment where branch_code=b and portfolio_id=p
    and private.uma_identity_key(tag)=private.uma_identity_key(r->>'tag');
   if a?'serial' and nullif(r->>'serial','') is not null and private.uma_identity_key(a->>'serial') is distinct from private.uma_identity_key(r->>'serial') then raise exception 'Nomor seri sumber dan data alat tidak konsisten.';end if;
   source_serial:=case when lower(trim(coalesce(r->>'serial',''))) in ('','n/a','na','-') then null else private.uma_identity_key(r->>'serial') end;
   ids:=null;match_basis:='new';
   if source_serial is not null then
    select array_agg(id) into ids from public.equipment where id=any(tag_ids) and private.uma_identity_key(serial)=source_serial;
    if cardinality(ids)>0 then match_basis:='tag_serial';end if;
    if coalesce(cardinality(ids),0)=0 then
     select array_agg(id) into ids from public.equipment where id=any(tag_ids)
      and lower(trim(coalesce(serial,''))) in ('','n/a','na','-')
      and private.uma_identity_key(name)=private.uma_identity_key(r->>'name');
     if cardinality(ids)>0 then match_basis:='tag_name_missing_serial';end if;
    end if;
    if coalesce(cardinality(ids),0)=0 and cardinality(tag_ids)>0 then
     -- A reused tag denotes separate instruments only when the file ALSO identifies the
     -- existing instrument(s) by their own serials. A lone conflicting serial is never guessed.
     if exists(select 1 from public.equipment old where old.id=any(tag_ids)
      and not exists(select 1 from jsonb_array_elements(items) src
       where upper(src->>'portfolio')=upper(r->>'portfolio')
        and private.uma_identity_key(src->>'tag')=private.uma_identity_key(old.tag)
        and private.uma_identity_key(src->>'serial')=private.uma_identity_key(old.serial)))
      then raise exception 'Tag ditemukan tetapi nomor seri berbeda. Sertakan alat lama dan alat baru dengan nomor seri masing-masing, atau periksa identitas.';end if;
    end if;
   else
    select array_agg(id) into ids from public.equipment where id=any(tag_ids)
     and private.uma_identity_key(name)=private.uma_identity_key(r->>'name');
    if coalesce(cardinality(ids),0)=0 and cardinality(tag_ids)=1 then ids:=tag_ids;end if;
    if coalesce(cardinality(ids),0)=0 and cardinality(tag_ids)>1 then raise exception 'Tag cocok ke beberapa alat. Isi nomor seri atau nama yang tepat.';end if;
    if cardinality(ids)>0 then match_basis:='tag_name';end if;
   end if;
   if cardinality(ids)>1 then raise exception 'Lebih dari satu alat cocok. Periksa nomor seri dan identitas alat.';end if;
   if coalesce(cardinality(ids),0)=0 then
    ne:=jsonb_populate_record(null::public.equipment,a||jsonb_build_object('name',r->>'name','tag',r->>'tag'));
    insert into public.equipment(branch_code,portfolio_id,name,tag,serial,brand,model,color,specification_size,item_condition,item_status,unit,location,notes,measurement_range,measurement_ranges)
     values(b,p,ne.name,ne.tag,ne.serial,ne.brand,ne.model,ne.color,ne.specification_size,ne.item_condition,ne.item_status,ne.unit,ne.location,ne.notes,ne.measurement_range,ne.measurement_ranges) returning * into e;
    eid:=e.id;action:='added';
   else
    eid:=ids[1];select * into e from public.equipment where id=eid and branch_code=b for update;
    if not e.is_active then raise exception 'Alat berada di Arsip. Pulihkan melalui direktori sebelum mengimpor.';end if;
    if not private.equipment_scope(b,eid,true) then raise exception 'Alat di luar kewenangan portofolio Anda.' using errcode='42501';end if;
    -- Unknown serial placeholders in a report do not erase a known identity.
    if source_serial is null and nullif(e.serial,'') is not null then a:=a-'serial';end if;
    ne:=jsonb_populate_record(e,a);action:='unchanged';
    if to_jsonb(ne) is distinct from to_jsonb(e) then
     update public.equipment set serial=ne.serial,brand=ne.brand,model=ne.model,color=ne.color,specification_size=ne.specification_size,
      item_condition=ne.item_condition,item_status=ne.item_status,unit=ne.unit,location=ne.location,notes=ne.notes,
      measurement_range=ne.measurement_range,measurement_ranges=ne.measurement_ranges where id=eid;
     action:='updated';end if;
   end if;
   source_key:=eid::text||':'||lower(coalesce(nullif(c->>'certificate_number',''),c->>'issue_date','latest'));
   if source_key=any(seen) then raise exception 'Alat dan peristiwa yang sama berulang dalam file.';end if;seen:=array_append(seen,source_key);
   if not c?'component_label' then c:=c||jsonb_build_object('component_label',private.rotameter_component(e.name,c->>'certificate_number'));end if;
   ca:='none';cid:=null;current_event:=null;
   select id into current_event from public.calibrations where equipment_id=eid and branch_code=b and is_active and coalesce(lower(trim(component_label)),'')=coalesce(lower(trim(c->>'component_label')),'')
    order by coalesce(issue_date,calibration_date) desc nulls last,created_at desc,id desc limit 1;
   same_cert:=nullif(trim(c->>'certificate_number'),'');
   if same_cert is not null then
    select array_agg(id) into matches from public.calibrations where equipment_id=eid and branch_code=b and is_active
     and private.uma_identity_key(certificate_number)=private.uma_identity_key(same_cert);
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
    insert into public.calibrations(equipment_id,branch_code,component_label,laboratory,certificate_number,issue_date,calibration_date,due_date,reported_due_date,interval_months,calculation_base,date_basis,date_source,result,notes,calibration_internal,calibration_external,significant_yes,significant_no,monitoring_measurements,correction_factor,calibration_date_original,due_date_original)
     values(eid,b,nv.component_label,nv.laboratory,nv.certificate_number,nv.issue_date,nv.issue_date,nv.due_date,nv.due_date,nv.interval_months,case when c?'due_date' and c->'due_date'='null'::jsonb then null else 'issue_date' end,'unverified','Impor monitoring UMA',coalesce(nv.result,'layak'),nv.notes,nv.calibration_internal,nv.calibration_external,nv.significant_yes,nv.significant_no,nv.monitoring_measurements,nv.correction_factor,coalesce(nv.issue_date::text,'N/A'),coalesce(nv.due_date::text,'N/A')) returning id into cid;
    ca:='added';
   elsif cid is not null then
    select * into ev from public.calibrations where id=cid and branch_code=b for update;
    nv:=jsonb_populate_record(ev,c);
    if c?'issue_date' then nv.calibration_date:=nv.issue_date;nv.calibration_date_original:=coalesce(nv.issue_date::text,'N/A');end if;
    if c?'due_date' then nv.reported_due_date:=nv.due_date;nv.due_date_original:=coalesce(nv.due_date::text,'N/A');if c->'due_date'='null'::jsonb then nv.calculation_base:=null;end if;end if;
    if (c?'issue_date' or c?'interval_months') and not c?'due_date' then
     nv.due_date:=case when nv.issue_date is not null and nv.interval_months is not null then (nv.issue_date+make_interval(months=>nv.interval_months))::date else nv.due_date end;
     nv.reported_due_date:=nv.due_date;end if;
    if c?'monitoring_measurements' then
     if exists(select 1 from jsonb_array_elements(nv.monitoring_measurements) g
      where coalesce(g->>'correction_factor','')='' and (select count(*) from jsonb_array_elements(coalesce(ev.monitoring_measurements,'[]'::jsonb)) oldg where oldg->>'measurement_range'=g->>'measurement_range')>1)
      then raise exception 'Rentang berulang memiliki beberapa faktor lama. Isi faktor koreksi secara eksplisit.';end if;
     select jsonb_agg(case when coalesce(g->>'correction_factor','')='' then g||jsonb_build_object('correction_factor',coalesce(
      (select oldg->>'correction_factor' from jsonb_array_elements(coalesce(ev.monitoring_measurements,'[]'::jsonb)) oldg where oldg->>'measurement_range'=g->>'measurement_range' limit 1),''))
      else g end order by i) into nv.monitoring_measurements from jsonb_array_elements(nv.monitoring_measurements) with ordinality x(g,i);
     select string_agg(g->>'correction_factor',E'\n' order by i) into nv.correction_factor from jsonb_array_elements(nv.monitoring_measurements) with ordinality x(g,i);
    end if;
    if to_jsonb(nv) is distinct from to_jsonb(ev) then
     update public.calibrations set component_label=nv.component_label,laboratory=nv.laboratory,certificate_number=nv.certificate_number,issue_date=nv.issue_date,calibration_date=nv.calibration_date,
      due_date=nv.due_date,reported_due_date=nv.reported_due_date,calibration_date_original=nv.calibration_date_original,due_date_original=nv.due_date_original,calculation_base=nv.calculation_base,interval_months=nv.interval_months,notes=nv.notes,result=nv.result,
      calibration_internal=nv.calibration_internal,calibration_external=nv.calibration_external,significant_yes=nv.significant_yes,significant_no=nv.significant_no,
      monitoring_measurements=nv.monitoring_measurements,correction_factor=nv.correction_factor,
      verification_status=case when c-'notes'<>'{}'::jsonb then 'pending' else ev.verification_status end where id=cid;
     ca:='updated';end if;
   end if;
   outcomes:=outcomes||jsonb_build_array(jsonb_build_object('sheet',r->>'sheet','row',r->'row','name',r->>'name','tag',r->>'tag','equipment_id',eid,'equipment',action,'calibration',ca,'match',match_basis));
  exception when others then problems:=array_append(problems,loc||': '||left(sqlerrm,350));end;
  if cardinality(problems)>=100 then exit;end if;
 end loop;
 if cardinality(problems)>0 then raise exception '%',array_to_string(problems,E'\n') using errcode='P0001';end if;
 return jsonb_build_object('run',runid,'rows',outcomes);
end $$;
