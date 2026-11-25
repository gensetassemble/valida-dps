-- QSHE monitors all personnel competency certificates in its assigned branch,
-- including employees without portfolio assignments. Mutation policies stay
-- restricted to HRGA/Admin; renewal and document reads reuse this scope.
create or replace function private.employee_scope(b text, employee uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.has_role(b,array['admin','hrga','branch_head','qshe'])
 or (private.has_role(b,array['inspector']) and exists(select 1 from public.profiles p where p.id=auth.uid() and p.employee_id=employee))
 or (private.has_role(b,array['coordinator']) and exists(select 1 from public.employee_portfolio_assignments a
 where a.employee_id=employee and a.branch_code=b and a.is_active and a.verification_status='verified'
 and a.effective_from<=(now() at time zone 'Asia/Makassar')::date and (a.effective_until is null or a.effective_until>=(now() at time zone 'Asia/Makassar')::date)
 and private.portfolio_scope(b,a.portfolio_id)));
$$;
