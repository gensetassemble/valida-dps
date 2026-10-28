create or replace function private.audit_business_record() returns trigger language plpgsql security definer set search_path='' as $$
declare j jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
 insert into public.audit_logs(table_name,record_id,action,actor_id,old_values,new_values,branch_code,database_actor)
 values(tg_table_name,coalesce(j->>'id',j->>'code'),tg_op,auth.uid(),case when tg_op<>'INSERT' then to_jsonb(old) end,
 case when tg_op<>'DELETE' then to_jsonb(new) end,coalesce(j->>'branch_code',j->>'code'),session_user);
 if tg_table_name='clients' and tg_op<>'DELETE' then
  if tg_op='INSERT' or new.account_manager_id is distinct from old.account_manager_id then
   insert into public.client_assignment_history(client_id,old_account_manager_id,new_account_manager_id,changed_by,reason,branch_code)
   values(new.id,case when tg_op='UPDATE' then old.account_manager_id end,new.account_manager_id,auth.uid(),coalesce(nullif(trim(new.assignment_reason),''),'Penetapan awal pelanggan.'),new.branch_code);
  end if;
 end if;
 return coalesce(new,old);
end $$;
revoke all on function private.audit_business_record() from public,anon,authenticated;
