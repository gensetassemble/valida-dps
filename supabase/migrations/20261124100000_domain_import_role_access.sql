-- Operational imports follow the accountable business role for each domain.
-- Admin/Super Admin access is retained only for the employee master import;
-- operational certificate imports require their explicit business role.
create or replace function private.import_role_scope(b text, d text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select case d
    when 'employees' then private.has_role(b, array['admin'])
    when 'personnel' then private.has_role(b, array['hrga'])
    when 'clients' then private.has_role(b, array['account_manager'])
    when 'calibrations' then private.has_role(b, array['equipment_manager'])
    else false
  end;
$$;

create or replace function private.import_batch_scope(batch uuid, b text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.import_batches candidate
    where candidate.id = batch
      and candidate.branch_code = b
      and private.import_role_scope(candidate.branch_code, candidate.domain)
  );
$$;

revoke all on function private.import_role_scope(text,text),
  private.import_batch_scope(uuid,text) from public, anon;
grant execute on function private.import_role_scope(text,text),
  private.import_batch_scope(uuid,text) to authenticated;

drop policy if exists batches_admin_read on public.import_batches;
drop policy if exists batches_role_read on public.import_batches;
create policy batches_role_read on public.import_batches
for select to authenticated
using (private.import_role_scope(branch_code, domain));

drop policy if exists rows_admin_read on public.import_rows;
drop policy if exists rows_role_read on public.import_rows;
create policy rows_role_read on public.import_rows
for select to authenticated
using (private.import_batch_scope(batch_id, branch_code));

drop policy if exists import_sources_admin on storage.objects;
create policy import_sources_admin on storage.objects
for select to authenticated
using (
  bucket_id='import-sources'
  and exists(
    select 1 from public.import_batches b
    where b.branch_code=(storage.foldername(name))[1]
      and b.id::text=(storage.foldername(name))[2]
      and private.import_role_scope(b.branch_code,b.domain)
  )
);

drop policy if exists import_sources_upload on storage.objects;
create policy import_sources_upload on storage.objects
for insert to authenticated
with check (
  bucket_id='import-sources'
  and exists(
    select 1 from public.import_batches b
    where b.branch_code=(storage.foldername(name))[1]
      and b.id::text=(storage.foldername(name))[2]
      and private.import_role_scope(b.branch_code,b.domain)
  )
);

create or replace function private.review_import(
  r uuid,
  n jsonb,
  approve boolean,
  reason text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  rowdata public.import_rows;
  import_domain text;
begin
  select source_row.*
    into rowdata
  from public.import_rows source_row
  join public.import_batches batch
    on batch.id=source_row.batch_id
   and batch.branch_code=source_row.branch_code
  where source_row.id=r
  for update of source_row;
  if not found then
    raise exception 'Baris impor tidak ditemukan.' using errcode='42501';
  end if;
  select domain into import_domain
  from public.import_batches
  where id=rowdata.batch_id and branch_code=rowdata.branch_code;
  if not private.import_role_scope(rowdata.branch_code,import_domain) then
    raise exception 'Akses pemeriksaan impor ditolak.' using errcode='42501';
  end if;
  if rowdata.decision='committed' then raise exception 'Baris telah diterapkan.';end if;
  if length(trim(reason))<8 or jsonb_typeof(n)<>'object' or octet_length(n::text)>20000 then
    raise exception 'Catatan atau koreksi tidak valid.';
  end if;
  update public.import_rows set
    normalized_values=rowdata.normalized_values||n,
    decision=case when approve then 'approved' else 'rejected' end,
    review_note=reason,
    reviewed_by=auth.uid(),
    reviewed_at=now()
  where id=r;
  insert into public.audit_logs(
    table_name,record_id,action,actor_id,old_values,new_values,branch_code,database_actor
  ) values(
    'import_rows',r::text,'UPDATE',auth.uid(),
    jsonb_build_object('decision',rowdata.decision,'normalized_values',rowdata.normalized_values),
    jsonb_build_object('decision',case when approve then 'approved' else 'rejected' end,'normalized_values',rowdata.normalized_values||n,'review_note',reason),
    rowdata.branch_code,session_user
  );
end;
$$;

do $$
declare
  definition text;
begin
  definition:=pg_get_functiondef('private.stage_import(text,text,text,text,integer,jsonb,text)'::regprocedure);
  if position('private.has_role(b,array[''admin''])' in definition)=0 then
    raise exception 'stage_import authorization definition changed; review required';
  end if;
  definition:=replace(definition,
    'private.has_role(b,array[''admin''])',
    'private.import_role_scope(b, d)');
  definition:=replace(definition,'Admin cabang diperlukan.','Peran penanggung jawab impor diperlukan.');
  execute definition;

  definition:=pg_get_functiondef('private.commit_import(uuid)'::regprocedure);
  if position('private.has_role(info.branch_code,array[''admin''])' in definition)=0 then
    raise exception 'commit_import authorization definition changed; review required';
  end if;
  execute replace(definition,
    'private.has_role(info.branch_code,array[''admin''])',
    'private.import_role_scope(info.branch_code, info.domain)');

  definition:=pg_get_functiondef('private.validate_import_approval()'::regprocedure);
  if position('private.has_role(new.branch_code,array[''admin''])' in definition)=0 then
    raise exception 'validate_import_approval authorization definition changed; review required';
  end if;
  definition:=replace(definition,
    'private.has_role(new.branch_code,array[''admin''])',
    'private.import_role_scope(new.branch_code, d)');
  definition:=replace(definition,'Admin diperlukan.','Peran penanggung jawab impor diperlukan.');
  execute definition;

  definition:=pg_get_functiondef('private.commit_client_certificate_import(uuid)'::regprocedure);
  if position('private.has_role(info.branch_code,array[''admin''])' in definition)=0 then
    raise exception 'client import authorization definition changed; review required';
  end if;
  execute replace(definition,
    'private.has_role(info.branch_code,array[''admin''])',
    'private.import_role_scope(info.branch_code, ''clients'')');

  definition:=pg_get_functiondef('private.stage_personnel_import(text,text,text,integer,jsonb,text)'::regprocedure);
  if position('private.has_role(b,array[''admin''])' in definition)=0 then
    raise exception 'personnel stage authorization definition changed; review required';
  end if;
  definition:=replace(definition,
    'private.has_role(b,array[''admin''])',
    'private.import_role_scope(b, ''personnel'')');
  definition:=replace(definition,'Admin cabang diperlukan.','Impor kompetensi hanya untuk HRGA.');
  execute definition;

  definition:=pg_get_functiondef('private.review_personnel_import(uuid,jsonb,boolean,text)'::regprocedure);
  if position('private.has_role(rowdata.branch_code,array[''admin''])' in definition)=0 then
    raise exception 'personnel review authorization definition changed; review required';
  end if;
  execute replace(definition,
    'private.has_role(rowdata.branch_code,array[''admin''])',
    'private.import_role_scope(rowdata.branch_code, ''personnel'')');

  definition:=pg_get_functiondef('private.approve_personnel_import_batch(uuid)'::regprocedure);
  if position('private.has_role(info.branch_code,array[''admin''])' in definition)=0 then
    raise exception 'personnel approval authorization definition changed; review required';
  end if;
  execute replace(definition,
    'private.has_role(info.branch_code,array[''admin''])',
    'private.import_role_scope(info.branch_code, ''personnel'')');

  definition:=pg_get_functiondef('private.commit_personnel_certificate_import(uuid)'::regprocedure);
  if position('private.has_role(info.branch_code,array[''admin''])' in definition)=0 then
    raise exception 'personnel commit authorization definition changed; review required';
  end if;
  execute replace(definition,
    'private.has_role(info.branch_code,array[''admin''])',
    'private.import_role_scope(info.branch_code, ''personnel'')');

  definition:=pg_get_functiondef('public.sync_equipment_uma(text,text,text,jsonb)'::regprocedure);
  if position('private.has_role(b,array[''admin'',''equipment_manager'',''coordinator''])' in definition)=0 then
    raise exception 'equipment import authorization definition changed; review required';
  end if;
  definition:=replace(definition,
    'private.has_role(b,array[''admin'',''equipment_manager'',''coordinator''])',
    'private.has_role(b,array[''equipment_manager''])');
  definition:=replace(definition,
    'Impor memerlukan Admin, PTK, atau Koordinator berwenang.',
    'Impor kalibrasi alat hanya untuk PTK.');
  execute definition;
end;
$$;

drop policy if exists equipment_sync_runs_read on public.equipment_sync_runs;
create policy equipment_sync_runs_read on public.equipment_sync_runs
for select to authenticated
using (private.has_role(branch_code,array['equipment_manager']));

drop policy if exists equipment_sync_runs_insert on public.equipment_sync_runs;
create policy equipment_sync_runs_insert on public.equipment_sync_runs
for insert to authenticated
with check (
  actor_id=auth.uid()
  and private.has_role(branch_code,array['equipment_manager'])
);
