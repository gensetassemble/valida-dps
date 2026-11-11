-- Preserve historical calibration dates. New events may use certificate issue_date only.
-- Keep existing columns, grants, predicates, and security-invoker behavior.
do $migration$
declare definition text; revised text;
begin
  definition := pg_get_viewdef('public.equipment_records'::regclass, true);
  revised := replace(definition,
    'ORDER BY c.calibration_date DESC NULLS LAST',
    'ORDER BY COALESCE(c.issue_date, c.calibration_date) DESC NULLS LAST');
  if revised = definition then raise exception 'Expected equipment event ordering was not found'; end if;
  execute 'create or replace view public.equipment_records with (security_invoker=true) as ' || revised;

  definition := pg_get_viewdef('public.equipment_monitoring_records'::regclass, true);
  revised := replace(definition,
    'c.calibration_date AS latest_calibration_date',
    'COALESCE(c.issue_date, c.calibration_date) AS latest_calibration_date');
  if revised = definition then raise exception 'Expected monitoring event date was not found'; end if;
  execute 'create or replace view public.equipment_monitoring_records with (security_invoker=true) as ' || revised;
end
$migration$;
