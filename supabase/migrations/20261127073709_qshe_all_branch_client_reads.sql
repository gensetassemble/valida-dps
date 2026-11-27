-- QSHE is explicitly authorized to read all operational data in its branch,
-- including customers without a portfolio. Preserve every mutation rule.
create or replace function private.client_scope(b text,c uuid,writing boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_role(b,array['admin']) or exists(
 select 1 from public.clients x where x.id=c and x.branch_code=b and (
   (private.has_role(b,array['account_manager']) and (not writing or x.account_manager_id=auth.uid()))
   or (not writing and private.has_role(b,array['branch_head','qshe']))));
$$;
alter policy employee_status_events_read on public.employee_status_events
 using(private.has_role(branch_code,array['admin','hrga','qshe']));
