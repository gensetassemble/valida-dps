-- A user can inspect their own portfolio grants without widening business data scope.
alter policy portfolios_assign_read on public.employee_portfolio_assignments using(
 private.employee_scope(branch_code,employee_id) or (private.actor_enabled() and private.branch_access(branch_code) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.employee_id=employee_portfolio_assignments.employee_id))
);
create index portfolio_coordinators_portfolio_branch on public.portfolio_coordinators(portfolio_id,branch_code);
