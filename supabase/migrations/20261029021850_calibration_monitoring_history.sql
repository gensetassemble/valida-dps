create view public.calibration_monitoring_records with (security_invoker=true) as
select r.*,c.interval_label,c.calibration_internal,c.calibration_external,c.correction_factor,
 c.significant_yes,c.significant_no,c.calibration_date_original,c.due_date_original
from public.calibration_records r join public.calibrations c on c.id=r.id;
revoke all on public.calibration_monitoring_records from public,anon;
grant select on public.calibration_monitoring_records to authenticated;
