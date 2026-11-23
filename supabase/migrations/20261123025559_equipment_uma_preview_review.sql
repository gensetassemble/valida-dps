-- UMA imports are screened in a rollback-only transaction before any canonical
-- equipment or calibration row is changed. The final run stores the review
-- classification in source_rows and is covered by the normal business audit.

create or replace function public.preview_equipment_uma(
  b text,
  filename text,
  filehash text,
  items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=''
set statement_timeout='45s'
set lock_timeout='5s'
as $$
declare
  result jsonb;
begin
  begin
    result := public.sync_equipment_uma(b, filename, filehash, items);
    raise exception using errcode='PUM01', message='ROLLBACK_UMA_PREVIEW';
  exception when sqlstate 'PUM01' then
    return result - 'run';
  end;
end
$$;

create or replace function public.apply_equipment_uma_reviewed(
  b text,
  filename text,
  filehash text,
  items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=''
set statement_timeout='45s'
set lock_timeout='5s'
as $$
declare
  item jsonb;
  classification text;
begin
  if jsonb_typeof(items) is distinct from 'array' then
    raise exception 'Format hasil screening tidak valid.';
  end if;

  for item in select value from jsonb_array_elements(items) loop
    classification := item->'review'->>'classification';
    if classification is null or classification not in (
      'calibration_event',
      'data_correction',
      'no_sensitive_change'
    ) then
      raise exception 'Setiap baris wajib memiliki hasil screening impor.';
    end if;
  end loop;

  return public.sync_equipment_uma(b, filename, filehash, items);
end
$$;

revoke all on function public.preview_equipment_uma(text,text,text,jsonb)
  from public, anon;
revoke all on function public.apply_equipment_uma_reviewed(text,text,text,jsonb)
  from public, anon;
grant execute on function public.preview_equipment_uma(text,text,text,jsonb)
  to authenticated;
grant execute on function public.apply_equipment_uma_reviewed(text,text,text,jsonb)
  to authenticated;

drop trigger if exists audit_equipment_sync_run on public.equipment_sync_runs;
create trigger audit_equipment_sync_run
after insert on public.equipment_sync_runs
for each row execute function private.audit_business_record();
