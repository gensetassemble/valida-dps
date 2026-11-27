-- Read-only access follows a coordinator's existing, current appointment.
-- Do not change portfolio_scope or coordinator_equipment_portfolio: both also
-- authorize mutations. No new role, appointment or individual grant is created.
create function private.coordinator_appointed_read(b text,p uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_role(b,array['coordinator']) and exists(
  select 1 from public.profiles u
  join public.portfolio_coordinators a on a.employee_id=u.employee_id and a.branch_code=b and a.portfolio_id=p
  join public.operational_coordinators c on c.id=a.coordinator_id and c.branch_code=b and c.is_active
  join public.portfolios po on po.id=p and po.branch_code=b and po.is_active
  where u.id=auth.uid() and a.is_active
  and a.effective_from<=(now() at time zone 'Asia/Makassar')::date
  and (a.effective_until is null or a.effective_until>=(now() at time zone 'Asia/Makassar')::date));
$$;
revoke all on function private.coordinator_appointed_read(text,uuid) from public,anon;
grant execute on function private.coordinator_appointed_read(text,uuid) to authenticated,service_role;

create or replace function private.readable_equipment_portfolio_ids() returns setof uuid
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.actor_enabled() then return;end if;
 return query select p.id from public.portfolios p
 where private.has_role(p.branch_code,array['admin','branch_head','equipment_manager','coordinator','qshe'])
 and (private.portfolio_scope(p.branch_code,p.id) or private.coordinator_appointed_read(p.branch_code,p.id));
end $$;
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
  where private.portfolio_scope(p.branch_code,p.id) or private.coordinator_appointed_read(p.branch_code,p.id)
 )
 select e.id from public.equipment e join branches b on b.code=e.branch_code
 where b.all_assets or exists(select 1 from portfolios p where p.id=e.portfolio_id and p.branch_code=e.branch_code);
end $$;
create or replace function private.equipment_scope(b text,e uuid,writing boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_role(b,array['admin']) or exists(select 1 from public.equipment x where x.id=e and x.branch_code=b and (
 (private.has_role(b,array['equipment_manager']) and private.portfolio_scope(b,x.portfolio_id))
 or (x.ownership='internal' and x.client_id is null and private.coordinator_equipment_portfolio(b,x.portfolio_id))
 or (not writing and (private.has_role(b,array['branch_head','qshe']) or (private.has_role(b,array['coordinator'])
 and (private.portfolio_scope(b,x.portfolio_id) or private.coordinator_appointed_read(b,x.portfolio_id)))))));
$$;
create or replace function private.employee_scope(b text,employee uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_role(b,array['admin','hrga','branch_head','qshe'])
 or (private.has_role(b,array['inspector']) and exists(select 1 from public.profiles p where p.id=auth.uid() and p.employee_id=employee))
 or (private.has_role(b,array['coordinator']) and exists(select 1 from public.employee_portfolio_assignments a
 where a.employee_id=employee and a.branch_code=b and a.is_active and a.verification_status='verified'
 and a.effective_from<=(now() at time zone 'Asia/Makassar')::date and (a.effective_until is null or a.effective_until>=(now() at time zone 'Asia/Makassar')::date)
 and (private.portfolio_scope(b,a.portfolio_id) or private.coordinator_appointed_read(b,a.portfolio_id))));
$$;
