do $migration$ declare definition text;needle text:='if profile is null then';begin
 definition:=pg_get_functiondef('public.save_profile_identity(text,uuid,jsonb)'::regprocedure);
 if position(needle in definition)=0 then raise exception 'Expected profile identity contract';end if;
 definition:=replace(definition,needle,'if number is null and profile is not null and exists(select 1 from public.employee_directory e where e.id=existing.employee_id and e.branch_code=b and e.npp is null) then emp:=existing.employee_id;end if; '||needle);
 execute definition;
end $migration$;
