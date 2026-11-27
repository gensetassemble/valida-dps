-- QSHE oversees all equipment in its own branch. Portfolio assignments still
-- limit operational write roles; this change applies only to reading.
create or replace function private.equipment_scope(b text,e uuid,writing boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_role(b,array['admin']) or exists(select 1 from public.equipment x where x.id=e and x.branch_code=b and (
 (private.has_role(b,array['equipment_manager']) and private.portfolio_scope(b,x.portfolio_id))
 or (x.ownership='internal' and x.client_id is null and private.coordinator_equipment_portfolio(b,x.portfolio_id))
 or (not writing and (private.has_role(b,array['branch_head','qshe']) or (private.has_role(b,array['coordinator']) and private.portfolio_scope(b,x.portfolio_id))))));
$$;
alter policy equipment_read on public.equipment using(
 private.has_role(branch_code,array['admin','branch_head','qshe']) or
 (private.has_role(branch_code,array['equipment_manager','coordinator']) and portfolio_id in(select private.readable_equipment_portfolio_ids()))
);
create or replace function private.readable_equipment_ids() returns setof uuid
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.actor_enabled() then return;end if;
 return query
 with branches as materialized (
  select b.code,private.has_role(b.code,array['admin','branch_head','qshe']) as all_assets
  from public.branches b where b.is_active and private.has_role(b.code,array['admin','branch_head','equipment_manager','coordinator','qshe'])
 ), portfolios as materialized (
  select p.id,p.branch_code from public.portfolios p join branches b on b.code=p.branch_code
  where private.portfolio_scope(p.branch_code,p.id)
 )
 select e.id from public.equipment e join branches b on b.code=e.branch_code
 where b.all_assets or exists(select 1 from portfolios p where p.id=e.portfolio_id and p.branch_code=e.branch_code);
end $$;
