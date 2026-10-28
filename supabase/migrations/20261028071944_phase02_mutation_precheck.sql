-- BEFORE-row guards may run before RLS WITH CHECK. Validate the actor first so an
-- unauthorized mutation cannot use privileged identity/FK validation as an oracle.
-- This trigger is SECURITY INVOKER and does not bypass any RLS policy.
create function private.authorize_mutation() returns trigger language plpgsql security invoker set search_path='' as $$
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
  if tg_op='INSERT' then allowed:=private.has_role(b,array['admin']) or (private.has_role(b,array['equipment_manager']) and private.portfolio_scope(b,new.portfolio_id));
  else allowed:=private.equipment_scope(b,new.id,true); end if;
 elsif tg_table_name='calibrations' then
  allowed:=private.equipment_scope(b,new.equipment_id,true);
 else allowed:=private.has_role(b,array['admin']);
 end if;
 if not allowed then raise exception 'Perubahan tidak diizinkan pada cakupan actor.' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function private.authorize_mutation() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['branches','profiles','work_areas','portfolios','portfolio_aliases','employee_directory','user_role_assignments','employee_portfolio_assignments','certificate_types','service_types','service_competency_requirements','clients','client_contacts','client_certificates','personnel_certificates','personnel_certificate_services','equipment','calibrations'] loop
  execute format('create trigger aa_authorize_mutation before insert or update on public.%I for each row execute function private.authorize_mutation()',t);
 end loop;
end $$;
