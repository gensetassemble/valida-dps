-- Compute the same authorized equipment set once per statement instead of rechecking
-- nested profile/role/portfolio queries for every calibration candidate in a lateral join.
create function private.readable_equipment_ids() returns setof uuid language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.actor_enabled() then return;end if;
 return query
 with branches as materialized (
  select b.code,private.has_role(b.code,array['admin','branch_head']) as all_assets
  from public.branches b where b.is_active and private.has_role(b.code,array['admin','branch_head','equipment_manager','coordinator','qshe'])
 ), portfolios as materialized (
  select p.id,p.branch_code from public.portfolios p join branches b on b.code=p.branch_code
  where private.portfolio_scope(p.branch_code,p.id)
 )
 select e.id from public.equipment e join branches b on b.code=e.branch_code
 where b.all_assets or exists(select 1 from portfolios p where p.id=e.portfolio_id and p.branch_code=e.branch_code);
end $$;
revoke all on function private.readable_equipment_ids() from public,anon;
grant execute on function private.readable_equipment_ids() to authenticated;
alter policy equipment_read on public.equipment using(id in(select private.readable_equipment_ids()));
alter policy calibrations_read on public.calibrations using(equipment_id in(select private.readable_equipment_ids()));
