alter table public.client_certificates
 add column interval_days integer check(interval_days between 1 and 36500),
 add column certificate_work_area_id uuid,
 add constraint client_interval_one_unit check(interval_days is null or interval_months is null),
 add constraint client_certificate_area_branch foreign key(certificate_work_area_id,branch_code) references public.work_areas(id,branch_code);
create index client_certificate_area_idx on public.client_certificates(certificate_work_area_id,branch_code);
alter table public.client_contacts add column is_test boolean not null default false;

create function private.client_certificate_dates() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.interval_days is not null and new.interval_months is not null then
  raise exception 'Pilih interval hari atau bulan, bukan keduanya.' using errcode='23514';
 end if;
 if new.expiry_date is null and new.issue_date is not null then
  if new.interval_days is not null then new.expiry_date:=new.issue_date+new.interval_days;
  elsif new.interval_months is not null then new.expiry_date:=(new.issue_date+make_interval(months=>new.interval_months))::date;end if;
 end if;
 if new.expiry_date<new.issue_date then raise exception 'Tanggal berakhir mendahului tanggal terbit.' using errcode='23514';end if;
 return new;
end $$;
revoke all on function private.client_certificate_dates() from public,anon,authenticated;
create trigger a_client_certificate_dates before insert or update on public.client_certificates
 for each row execute function private.client_certificate_dates();

-- Preserve every existing view column position and the caller's RLS.
do $$declare definition text;begin
 definition:=rtrim(pg_get_viewdef('public.client_certificate_records'::regclass,true),E';\n ');
 if position('cl.work_area_id,' in definition)=0 then raise exception 'Client view definition changed; review required.';end if;
 definition:=replace(definition,'cl.work_area_id,','coalesce(c.certificate_work_area_id,cl.work_area_id) AS work_area_id,');
 execute 'create or replace view public.client_certificate_records with(security_invoker=true) as select old.*,src.interval_days,src.certificate_work_area_id from ('||definition||') old join public.client_certificates src on src.id=old.id and src.branch_code=old.branch_code';
 definition:=rtrim(pg_get_viewdef('public.client_certificate_display_records'::regclass,true),E';\n ');
 execute 'create or replace view public.client_certificate_display_records with(security_invoker=true) as
 select old.*,src.interval_days,src.certificate_work_area_id,
 case when src.interval_days is not null then src.interval_days::text||'' hari'' when src.interval_months is not null then src.interval_months::text||'' bulan'' else null end as interval_label,
 p.code as portfolio_code,pic.name as pic_name,pic.email as pic_email,coalesce(pic.is_test,false) as pic_is_test
 from ('||definition||') old
 join public.client_certificates src on src.id=old.id and src.branch_code=old.branch_code
 left join public.portfolios p on p.id=old.scope_portfolio_id and p.branch_code=old.branch_code
 left join lateral(select name,email,is_test from public.client_contacts cc where cc.client_id=old.client_id and cc.branch_code=old.branch_code and cc.is_active and cc.is_primary order by cc.created_at,cc.id limit 1) pic on true';
end $$;

-- Existing reviewed import paths must retain day intervals and per-record geography.
do $$declare definition text;begin
 definition:=pg_get_functiondef('private.commit_import(uuid)'::regprocedure);
 if position('interval_months,previous_order_value,branch_code' in definition)=0 then raise exception 'Client import definition changed; review required.';end if;
 definition:=replace(definition,'interval_months,previous_order_value,branch_code','interval_months,interval_days,certificate_work_area_id,portfolio_id,previous_order_value,branch_code');
 definition:=replace(definition,'nullif(n->>''interval_months'','''')::integer,nullif(n->>''previous_order_value'','''')::numeric',
 'nullif(n->>''interval_months'','''')::integer,nullif(n->>''interval_days'','''')::integer,nullif(n->>''certificate_work_area_id'','''')::uuid,nullif(n->>''portfolio_id'','''')::uuid,nullif(n->>''previous_order_value'','''')::numeric');
 execute definition;
end $$;
