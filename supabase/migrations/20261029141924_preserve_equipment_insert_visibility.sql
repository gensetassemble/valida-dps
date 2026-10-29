-- Equipment SELECT uses the row's portfolio, so INSERT ... RETURNING can see a new
-- authorized row immediately. Calibration SELECT still reuses the equipment ID set.
create function private.readable_equipment_portfolio_ids() returns setof uuid language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.actor_enabled() then return;end if;
 return query select p.id from public.portfolios p where private.has_role(p.branch_code,array['admin','branch_head','equipment_manager','coordinator','qshe']) and private.portfolio_scope(p.branch_code,p.id);
end $$;
revoke all on function private.readable_equipment_portfolio_ids() from public,anon;
grant execute on function private.readable_equipment_portfolio_ids() to authenticated;
alter policy equipment_read on public.equipment using(
 private.has_role(branch_code,array['admin','branch_head']) or
 (private.has_role(branch_code,array['equipment_manager','coordinator','qshe']) and portfolio_id in(select private.readable_equipment_portfolio_ids()))
);
