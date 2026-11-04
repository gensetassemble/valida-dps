-- A customer reader may see the name of its assigned login account, without
-- gaining access to profile emails, authentication data or other profiles.
create function private.client_account_label(b text,c uuid) returns text
language sql stable security definer set search_path='' as $$
 select coalesce(nullif(p.full_name,''),nullif(p.display_name,''))
 from public.clients x join public.profiles p on p.id=x.account_manager_id
 where x.id=c and x.branch_code=b and p.branch_code=b
 and auth.uid() is not null and private.client_scope(b,c,false)
$$;
revoke all on function private.client_account_label(text,uuid) from public,anon;
grant execute on function private.client_account_label(text,uuid) to authenticated;
create view public.client_directory_records with(security_invoker=true) as
 select c.*,private.client_account_label(c.branch_code,c.id) as account_manager_label
 from public.clients c;
revoke all on public.client_directory_records from public,anon,authenticated;
grant select on public.client_directory_records to authenticated;
