-- Nominal equipment ranges are separate from certificate-specific measurement/factor snapshots.
create function private.valid_equipment_measurement_ranges(value jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare item jsonb;
begin
 if value is null then return true;end if;
 if jsonb_typeof(value) is distinct from 'array' then return false;end if;
 if jsonb_array_length(value) not between 1 and 200 then return false;end if;
 for item in select jsonb_array_elements(value) loop
  if jsonb_typeof(item) is distinct from 'string' or length(trim(item#>>'{}')) not between 1 and 2000 then return false;end if;
 end loop;
 return true;
end $$;
revoke all on function private.valid_equipment_measurement_ranges(jsonb) from public,anon;
grant execute on function private.valid_equipment_measurement_ranges(jsonb) to authenticated;
alter table public.equipment add column measurement_ranges jsonb
 check(private.valid_equipment_measurement_ranges(measurement_ranges));
-- No backfill or reinterpretation of imported ranges; forms use the existing certificate groups as fallback.
create or replace function public.create_equipment_with_calibration(b text,asset jsonb,calibration jsonb default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare eid uuid;k text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 if jsonb_typeof(asset) is distinct from 'object' then raise exception 'Invalid asset';end if;
 for k in select jsonb_object_keys(asset) loop
  if not k=any(array['name','asset_id','tag','brand','model','serial','measurement_range','measurement_ranges','location','portfolio_id','unit','ownership','client_id','responsible_employee_id','notes','is_active','color','specification_size','item_condition','item_status']) then raise exception 'Unexpected asset field';end if;
 end loop;
 if length(trim(coalesce(asset->>'name',''))) not between 2 and 200 then raise exception 'Asset name required';end if;
 insert into public.equipment(branch_code,name,asset_id,tag,brand,model,serial,measurement_range,measurement_ranges,location,portfolio_id,unit,ownership,client_id,responsible_employee_id,notes,is_active,color,specification_size,item_condition,item_status)
 values(b,asset->>'name',asset->>'asset_id',asset->>'tag',asset->>'brand',asset->>'model',asset->>'serial',asset->>'measurement_range',asset->'measurement_ranges',asset->>'location',(asset->>'portfolio_id')::uuid,asset->>'unit','internal',null,(asset->>'responsible_employee_id')::uuid,asset->>'notes',coalesce((asset->>'is_active')::boolean,true),asset->>'color',asset->>'specification_size',asset->>'item_condition',asset->>'item_status') returning id into eid;
 if calibration is not null then
  if jsonb_typeof(calibration) is distinct from 'object' then raise exception 'Invalid calibration';end if;
  for k in select jsonb_object_keys(calibration) loop
   if not k=any(array['calibration_date','due_date','interval_months','certificate_number','laboratory','interval_label','calibration_internal','calibration_external','correction_factor','monitoring_measurements','significant_yes','significant_no']) then raise exception 'Unexpected calibration field';end if;
  end loop;
  if nullif(calibration->>'calibration_date','') is null then raise exception 'Initial calibration date required';end if;
  if calibration ? 'monitoring_measurements' then
   if jsonb_typeof(calibration->'monitoring_measurements') is distinct from 'array' or jsonb_array_length(calibration->'monitoring_measurements') not between 1 and 200 then raise exception 'Kelompok ukur tidak valid';end if;
   if asset ? 'measurement_ranges' and jsonb_array_length(calibration->'monitoring_measurements')<>jsonb_array_length(asset->'measurement_ranges') then raise exception 'Jumlah kelompok faktor harus sama dengan rentang ukur';end if;
   for k in select generate_series(0,jsonb_array_length(calibration->'monitoring_measurements')-1)::text loop
    if jsonb_typeof(calibration->'monitoring_measurements'->k::integer) is distinct from 'object'
     or nullif(trim(calibration->'monitoring_measurements'->k::integer->>'measurement_range'),'') is null
     or (asset ? 'measurement_ranges' and (calibration->'monitoring_measurements'->k::integer->>'measurement_range') is distinct from (asset->'measurement_ranges'->>k::integer))
     then raise exception 'Pasangan rentang dan faktor tidak sesuai';end if;
   end loop;
  end if;
  insert into public.calibrations(equipment_id,branch_code,calibration_date,due_date,reported_due_date,interval_months,certificate_number,laboratory,interval_label,calibration_internal,calibration_external,correction_factor,monitoring_measurements,significant_yes,significant_no,date_basis,date_source)
  values(eid,b,(calibration->>'calibration_date')::date,(calibration->>'due_date')::date,(calibration->>'due_date')::date,(calibration->>'interval_months')::integer,calibration->>'certificate_number',calibration->>'laboratory',calibration->>'interval_label',calibration->>'calibration_internal',calibration->>'calibration_external',calibration->>'correction_factor',calibration->'monitoring_measurements',calibration->>'significant_yes',calibration->>'significant_no','unverified','Pencatatan kalibrasi awal melalui formulir alat');
 end if;
 return eid;
end $$;
revoke all on function public.create_equipment_with_calibration(text,jsonb,jsonb) from public,anon;
grant execute on function public.create_equipment_with_calibration(text,jsonb,jsonb) to authenticated;

