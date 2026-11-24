-- Super Admin can oversee and execute every import domain while the existing
-- accountable business roles retain their domain-specific access.
create or replace function private.import_role_scope(b text, d text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select case d
    when 'employees' then private.has_role(b, array['admin'])
    when 'personnel' then private.has_role(b, array['super_admin','hrga'])
    when 'clients' then private.has_role(b, array['super_admin','account_manager'])
    when 'calibrations' then private.has_role(b, array['super_admin','equipment_manager'])
    else false
  end;
$$;

do $$
declare
  definition text;
begin
  definition:=pg_get_functiondef('public.sync_equipment_uma(text,text,text,jsonb)'::regprocedure);
  if position('private.has_role(b,array[''equipment_manager''])' in definition)=0 then
    raise exception 'equipment import authorization definition changed; review required';
  end if;
  definition:=replace(
    definition,
    'private.has_role(b,array[''equipment_manager''])',
    'private.has_role(b,array[''super_admin'',''equipment_manager''])'
  );
  definition:=replace(
    definition,
    'Impor kalibrasi alat hanya untuk PTK.',
    'Impor kalibrasi alat hanya untuk Super Admin atau PTK.'
  );
  execute definition;
end;
$$;
