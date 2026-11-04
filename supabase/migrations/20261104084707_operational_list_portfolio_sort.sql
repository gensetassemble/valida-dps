-- Append read-only ordering projections without changing existing view definitions,
-- certificate portfolio assignments, renewal semantics, grants, or row policies.
do $migration$
declare view_name text; definition text; extra text;
begin
  foreach view_name in array array['personnel_certificate_portfolios','equipment_monitoring_records'] loop
    definition := rtrim(pg_get_viewdef(format('public.%I',view_name)::regclass,true), E';\n ');
    extra := case when view_name='personnel_certificate_portfolios' then
      ', (select string_agg(p.code, '' / '' order by p.code) from public.portfolios p where p.branch_code=base.branch_code and p.id=any(base.portfolio_ids)) as portfolio_sort_key'
      else '' end;
    execute format('create or replace view public.%I with (security_invoker=true) as select base.*, case base.validity_status when ''Expired'' then 0 when ''Kritis'' then 1 when ''Perhatian'' then 2 when ''Pantau'' then 3 when ''Aman'' then 4 when ''Tanggal Belum Diisi'' then 5 else 6 end as validity_priority%s from (%s) base', view_name,extra,definition);
  end loop;
end $migration$;
