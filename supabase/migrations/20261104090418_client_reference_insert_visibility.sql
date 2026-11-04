-- The stable client SELECT helper cannot see a just-inserted row in RETURNING.
-- Keep existing RLS and perform the read in the next SQL command instead.
do $migration$
declare definition text;
original text := $$insert into public.clients(branch_code,name,account_manager_id,is_active,verification_status)
        values(b,normalized,auth.uid(),true,'pending') returning clients.id into found_id;$$;
begin
  definition:=pg_get_functiondef('public.create_client_certificate_reference(text,text,text)'::regprocedure);
  if position(original in definition)=0 then raise exception 'Unexpected inline client function definition';end if;
  execute replace(definition,original,$$found_id:=gen_random_uuid();
      insert into public.clients(id,branch_code,name,account_manager_id,is_active,verification_status)
        values(found_id,b,normalized,auth.uid(),true,'pending');$$);
end $migration$;
