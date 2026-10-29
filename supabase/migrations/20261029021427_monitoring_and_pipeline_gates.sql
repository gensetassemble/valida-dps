-- Preserve every monitoring parameter without inferring calibration results.
-- All current source assets were unknown-owned; the user explicitly scoped this register to internal assets.
update public.equipment set ownership='internal',client_id=null where ownership='unknown';
alter table public.equipment alter column ownership set default 'internal';
alter table public.equipment add constraint equipment_internal_register check(ownership='internal' and client_id is null);
alter table public.equipment
 add column color text, add column specification_size text,
 add column item_condition text, add column item_status text;
alter table public.calibrations
 add column interval_label text, add column calibration_internal text,
 add column calibration_external text, add column correction_factor text,
 add column significant_yes text, add column significant_no text,
 add column calibration_date_original text, add column due_date_original text;

update public.calibrations c set
 interval_label=r.raw_values->>'IntervalAsli',
 calibration_internal=r.raw_values->>'KalibrasiInternalAsli',
 calibration_external=r.raw_values->>'KalibrasiEksternalAsli',
 correction_factor=r.raw_values->>'FaktorKoreksi',
 significant_yes=r.raw_values->>'SignifikanYaAsli',
 significant_no=r.raw_values->>'SignifikanTidakAsli',
 calibration_date_original=r.raw_values->>'TanggalKalibrasiAsli',
 due_date_original=r.raw_values->>'TanggalBerakhirAsli'
from public.import_rows r where r.id=c.source_import_row_id;

update public.equipment e set color=r.raw_values->>'Warna',
 specification_size=r.raw_values->>'UkuranSpesifikasi',
 item_condition=r.raw_values->>'KondisiBarangAsli',item_status=r.raw_values->>'StatusBarangAsli'
from public.equipment_records v join public.calibrations c on c.id=v.latest_calibration_id
join public.import_rows r on r.id=c.source_import_row_id where e.id=v.id;

create view public.equipment_monitoring_records with (security_invoker=true) as
select e.*,a.color,a.specification_size,a.item_condition,a.item_status,
 p.code as portfolio_code,p.name as portfolio_name,
 concat_ws(' / ',nullif(e.brand,''),nullif(e.model,'')) as brand_type,
 c.certificate_number as monitoring_certificate,
 coalesce(nullif(c.interval_label,''),c.interval_months::text||' bulan') as monitoring_interval,
 c.calibration_date as latest_calibration_date,c.laboratory as monitoring_laboratory,
 c.calibration_internal,c.calibration_external,c.correction_factor,c.significant_yes,c.significant_no,
 c.calibration_date_original,c.due_date_original
from public.equipment_records e join public.equipment a on a.id=e.id
left join public.calibrations c on c.id=e.latest_calibration_id
left join public.portfolios p on p.id=e.portfolio_id and p.branch_code=e.branch_code;
revoke all on public.equipment_monitoring_records from public,anon;
grant select on public.equipment_monitoring_records to authenticated;

-- The invoker's existing asset AND calibration RLS applies. Any failure rolls back both inserts.
create function public.create_equipment_with_calibration(b text,asset jsonb,calibration jsonb default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare eid uuid;k text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 if jsonb_typeof(asset) is distinct from 'object' then raise exception 'Invalid asset';end if;
 for k in select jsonb_object_keys(asset) loop
  if not k=any(array['name','asset_id','tag','brand','model','serial','measurement_range','location','portfolio_id','unit','ownership','client_id','responsible_employee_id','notes','is_active','color','specification_size','item_condition','item_status']) then raise exception 'Unexpected asset field';end if;
 end loop;
 if length(trim(coalesce(asset->>'name',''))) not between 2 and 200 then raise exception 'Asset name required';end if;
 insert into public.equipment(branch_code,name,asset_id,tag,brand,model,serial,measurement_range,location,portfolio_id,unit,ownership,client_id,responsible_employee_id,notes,is_active,color,specification_size,item_condition,item_status)
 values(b,asset->>'name',asset->>'asset_id',asset->>'tag',asset->>'brand',asset->>'model',asset->>'serial',asset->>'measurement_range',asset->>'location',(asset->>'portfolio_id')::uuid,asset->>'unit','internal',null,(asset->>'responsible_employee_id')::uuid,asset->>'notes',coalesce((asset->>'is_active')::boolean,true),asset->>'color',asset->>'specification_size',asset->>'item_condition',asset->>'item_status') returning id into eid;
 if calibration is not null then
  if jsonb_typeof(calibration) is distinct from 'object' then raise exception 'Invalid calibration';end if;
  for k in select jsonb_object_keys(calibration) loop
   if not k=any(array['calibration_date','due_date','interval_months','certificate_number','laboratory','interval_label','calibration_internal','calibration_external','correction_factor','significant_yes','significant_no']) then raise exception 'Unexpected calibration field';end if;
  end loop;
  if nullif(calibration->>'calibration_date','') is null then raise exception 'Initial calibration date required';end if;
  insert into public.calibrations(equipment_id,branch_code,calibration_date,due_date,reported_due_date,interval_months,certificate_number,laboratory,interval_label,calibration_internal,calibration_external,correction_factor,significant_yes,significant_no,date_basis,date_source)
  values(eid,b,(calibration->>'calibration_date')::date,(calibration->>'due_date')::date,(calibration->>'due_date')::date,(calibration->>'interval_months')::integer,calibration->>'certificate_number',calibration->>'laboratory',calibration->>'interval_label',calibration->>'calibration_internal',calibration->>'calibration_external',calibration->>'correction_factor',calibration->>'significant_yes',calibration->>'significant_no','unverified','Pencatatan kalibrasi awal melalui formulir alat');
 end if;
 return eid;
end $$;
revoke all on function public.create_equipment_with_calibration(text,jsonb,jsonb) from public,anon;
grant execute on function public.create_equipment_with_calibration(text,jsonb,jsonb) to authenticated;

create table public.renewal_communications(
 id uuid primary key default gen_random_uuid(),
 certificate_id uuid not null references public.client_certificates(id),
 client_id uuid not null references public.clients(id),branch_code text not null references public.branches(code),
 kind text not null check(kind in ('log','status')),stage text not null,
 pic_name text not null check(length(trim(pic_name)) between 2 and 200),
 channel text not null check(channel in ('email','phone','whatsapp','meeting')),
 recipient_email text,subject text,note text not null check(length(trim(note)) between 8 and 2000),
 document_id uuid references public.operational_documents(id),details jsonb not null default '{}',
 created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default now()
);
alter table public.renewal_communications enable row level security;
create policy renewal_communications_read on public.renewal_communications for select to authenticated using(private.client_scope(branch_code,client_id));
revoke all on public.renewal_communications from public,anon,authenticated;
grant select on public.renewal_communications to authenticated;
create index renewal_communications_certificate_idx on public.renewal_communications(certificate_id,created_at desc);
create index renewal_communications_client_idx on public.renewal_communications(client_id);
create index renewal_communications_created_by_idx on public.renewal_communications(created_by);
create index renewal_communications_document_idx on public.renewal_communications(document_id);
create index renewal_communications_branch_idx on public.renewal_communications(branch_code);

-- Only this authenticated, scoped private function may append logs. No UPDATE/DELETE API.
create function private.record_renewal_followup(cert uuid,target text,note text,details jsonb,doc uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.client_certificates;contact public.client_contacts;oid uuid;rid uuid;s text;k text;
begin
 select * into c from public.client_certificates where id=cert;
 if auth.uid() is null or not found or not private.client_scope(c.branch_code,c.client_id,true) then raise exception 'Pipeline access denied' using errcode='42501';end if;
 if length(trim(coalesce(note,''))) not between 8 and 2000 or jsonb_typeof(details) is distinct from 'object' then raise exception 'Invalid followup';end if;
 for k in select jsonb_object_keys(details) loop
  if not k=any(array['pic_name','contact_id','channel','recipient_email','subject','confirmed','document_number','document_date','follow_up_date','reason']) then raise exception 'Unexpected followup field';end if;
 end loop;
 if length(trim(coalesce(details->>'pic_name',''))) not between 2 and 200 or coalesce(details->>'channel','') not in ('email','phone','whatsapp','meeting') then raise exception 'PIC and channel required';end if;
 if details->>'channel'='email' and coalesce(details->>'recipient_email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Recipient email required';end if;
 if target is not null then
  if (details->>'confirmed')::boolean is distinct from true then raise exception 'Confirm completed activity';end if;
  if target='contacted' then
   select * into contact from public.client_contacts where id=(details->>'contact_id')::uuid and client_id=c.client_id and branch_code=c.branch_code and is_active and is_primary and verification_status='verified';
   if not found or contact.name is distinct from details->>'pic_name' or (details->>'channel'='email' and lower(contact.email) is distinct from lower(details->>'recipient_email')) then raise exception 'Select verified primary client contact';end if;
   if details->>'channel'='email' and length(trim(coalesce(details->>'subject',''))) not between 3 and 200 then raise exception 'Email subject required';end if;
  elsif target in ('offered','po_received') then
   if length(trim(coalesce(details->>'document_number',''))) not between 2 and 200 or nullif(details->>'document_date','') is null then raise exception 'Document number and date required';end if;
   perform (details->>'document_date')::date;
   if (details->>'document_date')::date > (now() at time zone 'Asia/Makassar')::date then raise exception 'Document date is in the future';end if;
  elsif target='deferred' then
   if nullif(details->>'follow_up_date','') is null or (details->>'follow_up_date')::date < (now() at time zone 'Asia/Makassar')::date then raise exception 'Future followup date required';end if;
  elsif target='not_renewed' then
   if length(trim(coalesce(details->>'reason',''))) < 8 then raise exception 'Closure reason required';end if;
  else raise exception 'Invalid target';end if;
  oid:=private.transition_renewal(cert,target,note,doc);s:=target;
 else
  select stage into s from public.renewal_opportunities where certificate_id=cert;
  s:=coalesce(s,'uncontacted');
  if doc is not null then raise exception 'Log has no document transition';end if;
 end if;
 insert into public.renewal_communications(certificate_id,client_id,branch_code,kind,stage,pic_name,channel,recipient_email,subject,note,document_id,details)
 values(cert,c.client_id,c.branch_code,case when target is null then 'log' else 'status' end,s,details->>'pic_name',details->>'channel',details->>'recipient_email',details->>'subject',note,doc,details) returning id into rid;
 return rid;
end $$;
revoke all on function private.record_renewal_followup(uuid,text,text,jsonb,uuid) from public,anon;
grant execute on function private.record_renewal_followup(uuid,text,text,jsonb,uuid) to authenticated;
create function public.record_renewal_followup(cert uuid,target text,note text,details jsonb,doc uuid default null)
returns uuid language sql security invoker set search_path='' as $$select private.record_renewal_followup(cert,target,note,details,doc)$$;
revoke all on function public.record_renewal_followup(uuid,text,text,jsonb,uuid) from public,anon;
grant execute on function public.record_renewal_followup(uuid,text,text,jsonb,uuid) to authenticated;
-- Prevent older clients from bypassing the detailed stage gates.
revoke execute on function public.transition_renewal(uuid,text,text,uuid) from authenticated;
revoke execute on function private.transition_renewal(uuid,text,text,uuid) from authenticated;
