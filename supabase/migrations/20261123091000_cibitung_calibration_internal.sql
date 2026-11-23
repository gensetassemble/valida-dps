-- Laboratorium Cibitung is SUCOFINDO's internal calibration laboratory.
-- Normalize historical rows so the monitoring table and exports agree with
-- the source laboratory name.
update public.calibrations
set calibration_internal = '√',
    calibration_external = '-'
where lower(trim(coalesce(laboratory, ''))) in (
  'pt sucofindo laboratorium cibitung',
  'pt. sucofindo laboratorium cibitung',
  'pt.sucofindo laboratorium cibitung',
  'pt sucofindo lab cibitung',
  'pt. sucofindo lab cibitung',
  'pt.sucofindo lab. cibitung',
  'laboratorium cibitung',
  'lab cibitung',
  'lab. cibitung',
  'lab.cibitung'
)
and (
  calibration_internal is distinct from '√'
  or calibration_external is distinct from '-'
);
