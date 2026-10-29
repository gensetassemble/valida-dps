-- Cross-table views remain SECURITY INVOKER; sensitive fields never enter a public cache.
create view public.personnel_certificate_portfolios with(security_invoker=true) as
 select c.*,array(select distinct a.portfolio_id from public.employee_portfolio_assignments a
 where a.employee_id=c.employee_id and a.branch_code=c.branch_code and a.is_active and a.verification_status='verified'
 and a.effective_from<=(now() at time zone 'Asia/Makassar')::date and (a.effective_until is null or a.effective_until>=(now() at time zone 'Asia/Makassar')::date)) as portfolio_ids
 from public.personnel_certificate_records c;
revoke all on public.personnel_certificate_portfolios from public,anon,authenticated;grant select on public.personnel_certificate_portfolios to authenticated;

create function private.guard_operational_dates() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.client_certificates;
begin
 if tg_table_name='calibrations' then
  if new.interval_months is not null then
   new.calculated_due_date:=case new.calculation_base when 'issue_date' then (new.issue_date+make_interval(months=>new.interval_months))::date when 'calibration_date' then (new.calibration_date+make_interval(months=>new.interval_months))::date end;
  else new.calculated_due_date:=null;end if;
  if new.due_date is null then new.due_date:=new.calculated_due_date;end if;
 elsif tg_table_name='client_certificates' and new.previous_certificate_id is not null then
  select * into p from public.client_certificates where id=new.previous_certificate_id and branch_code=new.branch_code;
  if not found or p.client_id<>new.client_id or p.id=new.id then raise exception 'Generasi sebelumnya harus milik pelanggan dan cabang yang sama.' using errcode='23514';end if;
  if exists(with recursive chain as(select id,previous_certificate_id from public.client_certificates where id=p.id union select c.id,c.previous_certificate_id from public.client_certificates c join chain x on c.id=x.previous_certificate_id) select 1 from chain where id=new.id) then raise exception 'Siklus generasi sertifikat ditolak.' using errcode='23514';end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_operational_dates() from public,anon,authenticated;
create trigger ab_operational_dates before insert or update on public.calibrations for each row execute function private.guard_operational_dates();
create trigger ab_certificate_generations before insert or update on public.client_certificates for each row execute function private.guard_operational_dates();

create function private.validate_import_approval() returns trigger language plpgsql security invoker set search_path='' as $$
declare d text;n jsonb:=new.normalized_values;k text;v text;
begin
 if new.decision<>'approved' then return new;end if;
 select domain into d from public.import_batches where id=new.batch_id and branch_code=new.branch_code;
 if not private.has_role(new.branch_code,array['admin']) then raise exception 'Admin diperlukan.' using errcode='42501';end if;
 foreach k in array array['issue_date','expiry_date','calibration_date','due_date'] loop
  v:=nullif(n->>k,'');if v is not null and (v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char(v::date,'YYYY-MM-DD')<>v) then raise exception 'Tanggal ISO tidak valid.';end if;
 end loop;
 if nullif(n->>'interval_months','') is not null and (n->>'interval_months')::integer not between 1 and 600 then raise exception 'Interval tidak valid.';end if;
 if d='employees' then
  if coalesce(n->>'npp','') !~ '^[0-9]{5}$' or length(trim(coalesce(n->>'full_name','')))<2 or coalesce(n->>'employment_category','') not in ('PT','PTT_REGULAR','PTT_PROJECT','LS') then raise exception 'NRK/nama/kategori belum dipetakan.';end if;
 elsif d='personnel' then
  if not exists(select 1 from public.employee_directory e where e.id=(n->>'employee_id')::uuid and e.branch_code=new.branch_code) or not exists(select 1 from public.certificate_types t where t.id=(n->>'certificate_type_id')::uuid and t.branch_code=new.branch_code and t.category='personnel' and t.is_active) then raise exception 'Identitas/katalog belum dipetakan.';end if;
  if length(trim(coalesce(n->>'original_title','')))<2 or coalesce(n->>'validity_kind','') not in ('term','lifetime') then raise exception 'Judul/masa berlaku wajib dipilih.';end if;
  if n->>'validity_kind'='term' and nullif(n->>'expiry_date','') is null then raise exception 'Masa berlaku berjangka memerlukan tanggal akhir.';end if;
  if n->>'validity_kind'='lifetime' and (nullif(n->>'expiry_date','') is not null or nullif(n->>'interval_months','') is not null) then raise exception 'Lifetime tidak memakai tanggal akhir/interval.';end if;
 elsif d='calibrations' then
  if not exists(select 1 from public.equipment e where e.id=(n->>'equipment_id')::uuid and e.branch_code=new.branch_code and e.verification_status='verified') then raise exception 'Aset terverifikasi wajib dipetakan.';end if;
  if nullif(n->>'calibration_date','') is null or nullif(n->>'due_date','') is null then raise exception 'Tanggal kalibrasi/akhir wajib ditinjau.';end if;
 elsif d='clients' then
  if not exists(select 1 from public.clients c where c.id=(n->>'client_id')::uuid and c.branch_code=new.branch_code) or not exists(select 1 from public.certificate_types t where t.id=(n->>'certificate_type_id')::uuid and t.branch_code=new.branch_code and t.category='client' and t.is_active) then raise exception 'Pelanggan/katalog belum dipetakan.';end if;
  if nullif(n->>'certificate_number','') is null or nullif(n->>'object_type','') is null or nullif(n->>'issue_date','') is null or nullif(n->>'expiry_date','') is null then raise exception 'Identitas objek dan tanggal wajib ditinjau.';end if;
 end if;
 return new;
end $$;
revoke all on function private.validate_import_approval() from public,anon,authenticated;
create trigger import_approval_validation before insert or update on public.import_rows for each row execute function private.validate_import_approval();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('import-sources','import-sources',false,5242880,array['text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
create policy import_sources_admin on storage.objects for select to authenticated using(bucket_id='import-sources' and exists(select 1 from public.import_batches b where b.branch_code=(storage.foldername(name))[1] and b.id::text=(storage.foldername(name))[2] and private.has_role(b.branch_code,array['admin'])));
create policy import_sources_upload on storage.objects for insert to authenticated with check(bucket_id='import-sources' and exists(select 1 from public.import_batches b where b.branch_code=(storage.foldername(name))[1] and b.id::text=(storage.foldername(name))[2] and private.has_role(b.branch_code,array['admin'])));

create view public.operational_scope_records with(security_invoker=true) as
 select 'clients'::text as domain,c.id,c.branch_code,c.client_name as entity_name,c.certificate_number as title,c.expiry_date,c.validity_status,c.verification_status,c.previous_order_value,c.client_id,c.account_manager_id,c.work_area_id,array[c.scope_portfolio_id] as portfolio_ids,c.certificate_type_id,c.is_example
 from public.client_certificate_records c where c.is_active
 union all
 select 'personnel',c.id,c.branch_code,c.employee_name,c.original_title,c.expiry_date,c.validity_status,c.verification_status,null::numeric,null::uuid,null::uuid,null::uuid,c.portfolio_ids,c.certificate_type_id,false from public.personnel_certificate_portfolios c where c.is_active
 union all
 select 'calibrations',e.id,e.branch_code,e.name,e.tag,e.latest_due_date,e.validity_status,e.verification_status,null::numeric,e.client_id,null::uuid,null::uuid,array[e.portfolio_id],null::uuid,false from public.equipment_records e where e.is_active;
revoke all on public.operational_scope_records from public,anon,authenticated;grant select on public.operational_scope_records to authenticated;
create function public.operational_summary(b text,filters jsonb default '{}') returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not private.branch_access(b) then raise exception 'Cabang tidak dapat diakses.' using errcode='42501';end if;
 with visible as(
 select * from public.operational_scope_records r where r.branch_code=b
 and (not r.is_example or filters->>'examples'='true')
 and (nullif(filters->>'category','') is null or filters->>'category'='all' or r.domain=filters->>'category')
 and (nullif(filters->>'validity','') is null or r.validity_status=filters->>'validity')
 and (nullif(filters->>'client','') is null or r.client_id::text=filters->>'client')
 and (nullif(filters->>'am','') is null or r.account_manager_id::text=filters->>'am')
 and (nullif(filters->>'area','') is null or r.work_area_id::text=filters->>'area')
 and (nullif(filters->>'type','') is null or r.certificate_type_id::text=filters->>'type')
 and (nullif(filters->>'portfolio','') is null or exists(select 1 from unnest(r.portfolio_ids) p where p::text=filters->>'portfolio'))
 and (nullif(filters->>'from','') is null or r.expiry_date::text>=filters->>'from')
 and (nullif(filters->>'until','') is null or r.expiry_date::text<=filters->>'until')
 ),buckets as(select validity_status,count(*) as total from visible group by validity_status),
 soon as(select * from visible where expiry_date between (now() at time zone 'Asia/Makassar')::date and (now() at time zone 'Asia/Makassar')::date+90 and validity_status not in ('Perlu Verifikasi','Berlaku Seumur Hidup') order by expiry_date,id limit 20)
 select jsonb_build_object('total',(select count(*) from visible),'example_count',(select count(*) from visible where is_example),'buckets',coalesce((select jsonb_object_agg(validity_status,total) from buckets),'{}'),
 'soon',coalesce((select jsonb_agg(to_jsonb(soon)) from soon),'[]'),
 'real_client_count',(select count(*) from visible where domain='clients' and not is_example),
 'opportunity',(select sum(previous_order_value)::text from visible where domain='clients' and not is_example and verification_status='verified' and expiry_date between (now() at time zone 'Asia/Makassar')::date and (now() at time zone 'Asia/Makassar')::date+90)) into result;
 return result;
end $$;
revoke all on function public.operational_summary(text,jsonb) from public,anon;grant execute on function public.operational_summary(text,jsonb) to authenticated;
