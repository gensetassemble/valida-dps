create function private.coordinator_equipment_portfolio(b text,p uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_role(b,array['coordinator']) and exists(
 select 1 from public.profiles u join public.employee_portfolio_assignments a on a.employee_id=u.employee_id and a.branch_code=b
 where u.id=auth.uid() and a.portfolio_id=p and a.assignment_type='coordinator' and a.is_active and a.verification_status='verified' and a.approved_at is not null
 and a.effective_from<=(now() at time zone 'Asia/Makassar')::date and (a.effective_until is null or a.effective_until>=(now() at time zone 'Asia/Makassar')::date));
$$;
revoke all on function private.coordinator_equipment_portfolio(text,uuid) from public,anon;
grant execute on function private.coordinator_equipment_portfolio(text,uuid) to authenticated;
create or replace function private.equipment_scope(b text,e uuid,writing boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_role(b,array['admin']) or exists(select 1 from public.equipment x where x.id=e and x.branch_code=b and (
 (private.has_role(b,array['equipment_manager']) and private.portfolio_scope(b,x.portfolio_id))
 or (x.ownership='internal' and x.client_id is null and private.coordinator_equipment_portfolio(b,x.portfolio_id))
 or (not writing and (private.has_role(b,array['branch_head']) or (private.has_role(b,array['coordinator','qshe']) and private.portfolio_scope(b,x.portfolio_id))))));
$$;
alter policy equipment_insert on public.equipment with check(private.has_role(branch_code,array['admin']) or (private.has_role(branch_code,array['equipment_manager']) and private.portfolio_scope(branch_code,portfolio_id)) or (ownership='internal' and client_id is null and private.coordinator_equipment_portfolio(branch_code,portfolio_id)));

create or replace function private.authorize_mutation() returns trigger language plpgsql security invoker set search_path='' as $$
declare j jsonb:=to_jsonb(new); b text:=coalesce(j->>'branch_code',j->>'code'); allowed boolean:=false;
begin
 if auth.uid() is null then
  if current_user in ('postgres','supabase_admin','service_role') then return new; end if;
  raise exception 'Actor autentikasi diperlukan.' using errcode='42501';
 end if;
 if tg_table_name='profiles' then
  allowed:=(new.id<>auth.uid() and private.has_role(b,array['admin']));
 elsif tg_table_name='user_role_assignments' then
  allowed:=(new.profile_id<>auth.uid() and private.has_role(b,array['admin']));
 elsif tg_table_name='branches' then
  allowed:=(tg_op='UPDATE' and private.has_role(b,array['admin']));
 elsif tg_table_name in ('employee_directory','personnel_certificates','personnel_certificate_services') then
  allowed:=private.has_role(b,array['admin','hrga']);
 elsif tg_table_name='employee_portfolio_assignments' then
  allowed:=private.has_role(b,array['admin']) or (new.assignment_type='personnel' and private.has_role(b,array['hrga']));
 elsif tg_table_name='clients' then
  if tg_op='INSERT' then
   allowed:=private.has_role(b,array['admin']) or (private.has_role(b,array['account_manager']) and new.account_manager_id=auth.uid());
  else allowed:=private.client_scope(b,new.id,true); end if;
 elsif tg_table_name in ('client_contacts','client_certificates') then
  allowed:=private.client_scope(b,new.client_id,true);
 elsif tg_table_name='equipment' then
  if tg_op='INSERT' then allowed:=private.has_role(b,array['admin']) or (private.has_role(b,array['equipment_manager']) and private.portfolio_scope(b,new.portfolio_id)) or (new.ownership='internal' and new.client_id is null and private.coordinator_equipment_portfolio(b,new.portfolio_id));
  else allowed:=private.equipment_scope(b,new.id,true) and (private.has_role(b,array['admin','equipment_manager']) or (new.ownership='internal' and new.client_id is null and private.coordinator_equipment_portfolio(b,new.portfolio_id))); end if;
 elsif tg_table_name='calibrations' then
  allowed:=private.equipment_scope(b,new.equipment_id,true);
 else allowed:=private.has_role(b,array['admin']);
 end if;
 if not allowed then raise exception 'Perubahan tidak diizinkan pada cakupan actor.' using errcode='42501'; end if;
 return new;
end $$;
