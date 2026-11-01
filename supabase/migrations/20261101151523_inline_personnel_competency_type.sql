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
 elsif tg_table_name='certificate_types' then
  allowed:=private.has_role(b,array['admin']) or (tg_op='INSERT' and new.category='personnel' and private.has_role(b,array['hrga']));
 elsif tg_table_name='calibrations' then
  allowed:=private.equipment_scope(b,new.equipment_id,true);
 else allowed:=private.has_role(b,array['admin']);
 end if;
 if not allowed then raise exception 'Perubahan tidak diizinkan pada cakupan actor.' using errcode='42501'; end if;
 return new;
end $$;


-- HRGA may create personnel types, never edit client/equipment catalog entries.
create policy personnel_type_insert on public.certificate_types for insert to authenticated
 with check(category='personnel' and private.has_role(branch_code,array['hrga']));

create function public.create_personnel_competency_type(b text, type_name text)
 returns table(id uuid,name text) language plpgsql security invoker set search_path='' as $$
declare normalized text:=regexp_replace(trim(type_name),'\s+',' ','g'); found_id uuid;
begin
 if auth.uid() is null or not private.has_role(b,array['admin','hrga']) then
  raise exception 'Penambahan jenis kompetensi hanya untuk HRGA atau Admin pada cabang ini.' using errcode='42501';
 end if;
 if normalized is null or char_length(normalized) not between 2 and 160 then
  raise exception 'Nama jenis kompetensi harus 2–160 karakter.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(b||':personnel:'||lower(normalized),0));
 select t.id into found_id from public.certificate_types t
 where t.branch_code=b and t.category='personnel'
 and lower(regexp_replace(trim(t.name),'\s+',' ','g'))=lower(normalized)
 order by t.is_active desc,t.created_at limit 1;
 if found_id is not null then
  if not exists(select 1 from public.certificate_types t where t.id=found_id and t.is_active) then
   raise exception 'Jenis kompetensi sudah ada tetapi nonaktif. Hubungi Admin untuk memulihkannya.';
  end if;
 else
  insert into public.certificate_types(branch_code,code,name,category,is_active)
  values(b,'KP-'||gen_random_uuid()::text,normalized,'personnel',true) returning certificate_types.id into found_id;
 end if;
 return query select t.id,t.name from public.certificate_types t where t.id=found_id;
end $$;
revoke all on function public.create_personnel_competency_type(text,text) from public,anon;
grant execute on function public.create_personnel_competency_type(text,text) to authenticated;
