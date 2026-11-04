-- Client certificate management is shared by the branch commercial team.
-- Kabid PDOS currently holds both department_head and account_manager; other
-- department/unit heads retain read-only access. Customer ownership stays intact.
create or replace function private.client_scope(b text,c uuid,writing boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
 select private.has_role(b,array['admin']) or exists(
 select 1 from public.clients x where x.id=c and x.branch_code=b and (
   (private.has_role(b,array['account_manager']) and (not writing or x.account_manager_id=auth.uid()))
   or (not writing and (private.has_role(b,array['branch_head']) or
      (private.has_role(b,array['qshe']) and private.portfolio_scope(b,x.portfolio_id))))));
$$;
create function private.client_certificate_scope(b text,c uuid,writing boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.clients x where x.id=c and x.branch_code=b)
 and (private.has_role(b,array['admin','account_manager']) or (not writing and private.client_scope(b,c)));
$$;
revoke all on function private.client_certificate_scope(text,uuid,boolean) from public,anon;
grant execute on function private.client_certificate_scope(text,uuid,boolean) to authenticated;
alter policy client_records_read on public.client_certificates using(private.client_certificate_scope(branch_code,client_id));
alter policy client_records_insert on public.client_certificates with check(private.client_certificate_scope(branch_code,client_id,true));
alter policy client_records_edit on public.client_certificates using(private.client_certificate_scope(branch_code,client_id,true)) with check(private.client_certificate_scope(branch_code,client_id,true));

-- Keep all unrelated mutation branches and document domains exactly as deployed.
do $$declare definition text;begin
 definition:=pg_get_functiondef('private.authorize_mutation()'::regprocedure);
 if position('elsif tg_table_name in (''client_contacts'',''client_certificates'') then' in definition)=0 then raise exception 'Mutation guard changed; review required';end if;
 definition:=replace(definition,
  'elsif tg_table_name in (''client_contacts'',''client_certificates'') then',
  'elsif tg_table_name=''client_certificates'' then allowed:=private.client_certificate_scope(b,new.client_id,true); elsif tg_table_name=''client_contacts'' then');
 execute definition;
 definition:=pg_get_functiondef('private.document_scope(text,text,uuid,boolean)'::regprocedure);
 if position('private.client_scope(b,c.client_id,w)' in definition)=0 then raise exception 'Document scope changed';end if;
 execute replace(definition,'private.client_scope(b,c.client_id,w)','private.client_certificate_scope(b,c.client_id,w)');
 -- Shared certificate management includes follow-up, preserving stage gates.
 for definition in select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='record_renewal_followup' loop
  if position('private.client_scope(c.branch_code,c.client_id,true)' in definition)=0 then raise exception 'Renewal scope changed';end if;
  execute replace(definition,'private.client_scope(c.branch_code,c.client_id,true)','private.client_certificate_scope(c.branch_code,c.client_id,true)');
 end loop;
end $$;
