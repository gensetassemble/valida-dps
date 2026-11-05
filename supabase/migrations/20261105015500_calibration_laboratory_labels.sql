-- Standard display names; the original calibrations.laboratory values remain intact.
-- Replace the existing text column in place so sorting and exports share its label.
do $migration$
declare target record; definition text; columns_sql text; label_sql text;
begin
  for target in select * from (values
    ('equipment_monitoring_records', 'monitoring_laboratory'),
    ('calibration_monitoring_records', 'laboratory')
  ) as targets(view_name, field_name)
  loop
    definition := regexp_replace(pg_get_viewdef(format('public.%I', target.view_name)::regclass, true), ';\s*$', '');
    label_sql := format($label$case when source.branch_code='DPS' then case lower(regexp_replace(trim(source.%I), '\s+', ' ', 'g'))
        when 'pt sucofindo laboratorium cibitung' then 'PT SUCOFINDO Laboratorium Cibitung'
        when 'laboratorium snsu-bsn' then 'Laboratorium SNSU-BSN'
        when 'brin' then 'BRIN'
        when 'bspji' then 'BSPJI'
        when 'pusarpedal' then 'PUSARPEDAL'
        when 'psiklh' then 'PSIKLH'
        when 'pt kaliman' then 'PT Kaliman'
        when 'pt aus ndt' then 'PT AUS NDT'
        when 'pt caltesys indonesia' then 'PT Caltesys Indonesia'
        when 'pt caltesys indonesia (sby)' then 'PT Caltesys Indonesia (SBY)'
        when 'pt delta instrumen' then 'PT Delta Instrumen'
        when 'pt enseval medika prima' then 'PT Enseval Medika Prima'
        when 'pt trusur unggul teknusa' then 'PT Trusur Unggul Teknusa'
        when 'lab cibitung' then 'PT SUCOFINDO Laboratorium Cibitung'
        when 'lab. cibitung' then 'PT SUCOFINDO Laboratorium Cibitung'
        when 'lab.cibitung' then 'PT SUCOFINDO Laboratorium Cibitung'
        when 'laboratorium cibitung' then 'PT SUCOFINDO Laboratorium Cibitung'
        when 'pt. sucofindo lab cibitung' then 'PT SUCOFINDO Laboratorium Cibitung'
        when 'pt. sucofindo laboratorium cibitung' then 'PT SUCOFINDO Laboratorium Cibitung'
        when 'pt.sucofindo lab. cibitung' then 'PT SUCOFINDO Laboratorium Cibitung'
        when 'pt. kaliman' then 'PT Kaliman'
        when 'pt. aus ndt' then 'PT AUS NDT'
        when 'pt. caltesys indonesia' then 'PT Caltesys Indonesia'
        when 'pt. caltesys indonesia - sby' then 'PT Caltesys Indonesia (SBY)'
        when 'pt. delta instrumen' then 'PT Delta Instrumen'
        when 'pt. enseval medika prima' then 'PT Enseval Medika Prima'
        when 'pt. trusur unggul teknusa' then 'PT Trusur Unggul Teknusa'
        when '''pusarpedal' then 'PUSARPEDAL'
        else source.%I end else source.%I end as %I$label$,
        target.field_name, target.field_name, target.field_name, target.field_name);
    select string_agg(case when attname=target.field_name then label_sql else format('source.%I',attname) end, ', ' order by attnum)
      into columns_sql from pg_attribute where attrelid=format('public.%I',target.view_name)::regclass and attnum>0 and not attisdropped;
    execute format('create or replace view public.%I with (security_invoker=true) as select %s from (%s) source',target.view_name,columns_sql,definition);
  end loop;
end
$migration$;
