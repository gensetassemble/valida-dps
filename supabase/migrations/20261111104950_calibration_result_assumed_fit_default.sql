-- User instruction (11 November 2026): temporarily assume recorded calibration results are Layak.
-- This assumption does not verify certificates or extend their validity dates.
alter table public.calibrations alter column result set default 'layak';
do $backfill$
declare before_rows jsonb;
begin
 select jsonb_agg(to_jsonb(c)) into before_rows from public.calibrations c where branch_code='DPS' and result is null;
 update public.calibrations set result='layak' where branch_code='DPS' and result is null;
 if exists (select 1 from jsonb_array_elements(coalesce(before_rows,'[]'::jsonb)) b join public.calibrations c on c.id=(b->>'id')::uuid where (b - array['result','updated_at','updated_by']) is distinct from (to_jsonb(c) - array['result','updated_at','updated_by'])) then
  raise exception 'Backfill cancelled: a business field other than result changed';
 end if;
end
$backfill$;
