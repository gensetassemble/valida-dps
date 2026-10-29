-- One certificate may cover several ranges/parameters on the same physical asset.
alter table public.calibrations add column monitoring_measurements jsonb
 check (monitoring_measurements is null or (jsonb_typeof(monitoring_measurements)='array' and jsonb_array_length(monitoring_measurements)<=200));
create or replace view public.equipment_monitoring_records with (security_invoker=true) as
select e.*,a.color,a.specification_size,a.item_condition,a.item_status,
 p.code as portfolio_code,p.name as portfolio_name,
 concat_ws(' / ',nullif(e.brand,''),nullif(e.model,'')) as brand_type,
 c.certificate_number as monitoring_certificate,
 coalesce(nullif(c.interval_label,''),c.interval_months::text||' bulan') as monitoring_interval,
 c.calibration_date as latest_calibration_date,c.laboratory as monitoring_laboratory,
 c.calibration_internal,c.calibration_external,c.correction_factor,c.significant_yes,c.significant_no,
 c.calibration_date_original,c.due_date_original,c.monitoring_measurements
from public.equipment_records e join public.equipment a on a.id=e.id
left join public.calibrations c on c.id=e.latest_calibration_id
left join public.portfolios p on p.id=e.portfolio_id and p.branch_code=e.branch_code;
create or replace view public.calibration_monitoring_records with (security_invoker=true) as
select r.*,c.interval_label,c.calibration_internal,c.calibration_external,c.correction_factor,
 c.significant_yes,c.significant_no,c.calibration_date_original,c.due_date_original,c.monitoring_measurements
from public.calibration_records r join public.calibrations c on c.id=r.id;
