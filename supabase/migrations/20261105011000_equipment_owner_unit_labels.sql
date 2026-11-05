-- Canonical owner-unit labels, with original equipment.unit/location preserved.
-- The existing security-invoker view, grants and column order remain intact.
do $migration$
declare definition text;
begin
  definition := regexp_replace(pg_get_viewdef('public.equipment_monitoring_records'::regclass, true), ';\s*$', '');
  execute 'create or replace view public.equipment_monitoring_records with (security_invoker=true) as select source.*, case lower(regexp_replace(trim(source.unit), ''\s+'', '' '', ''g''))
        when ''denpasar'' then ''Denpasar''
        when ''up lombok'' then ''UP Lombok''
        when ''up benete'' then ''UP Benete''
        when ''celukan bawang'' then ''Celukan Bawang''
        when ''gilimanuk'' then ''Gilimanuk''
        when ''kubu'' then ''Kubu''
        when ''tbbm manggis'' then ''TBBM Manggis''
        when ''tbbm reo'' then ''TBBM Reo''
        when ''tbbm alabahi'' then ''TBBM Alabahi''
        when ''tbbm lombok'' then ''TBBM Lombok''
        when ''pemaron'' then ''Pemaron''
        when ''site lifuleo'' then ''Site Lifuleo''
        when ''lombok'' then ''UP Lombok''
        when ''cab. denpasar -- lombok'' then ''UP Lombok''
        when ''denpasar -- benete'' then ''UP Benete''
        when ''denpasar -- manggis'' then ''TBBM Manggis''
        when ''cab. denpasar'' then ''Denpasar''
        when ''denpasar (alat hibah dari lab cibitung)'' then ''Denpasar''
        when ''denpasar - celukan bawang'' then ''Celukan Bawang''
        when ''denpasar celukan bawang'' then ''Celukan Bawang''
        when ''denpasar -- giliimanuk'' then ''Gilimanuk''
        when ''denpasar -- gilimanuk'' then ''Gilimanuk''
        when ''denpasar--gilimanuk'' then ''Gilimanuk''
        when ''denpasar -- pemaron'' then ''Pemaron''
        when ''denpasar -- tbbm alabahi'' then ''TBBM Alabahi''
        when ''denpasar -- tbbm lombok'' then ''TBBM Lombok''
        when ''denpasar -- tbbm reo'' then ''TBBM Reo''
        else nullif(trim(source.unit), '''') end as owner_unit from (' || definition || ') source';
end
$migration$;
