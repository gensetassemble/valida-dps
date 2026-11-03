-- Deliver each stage, including cancellation/completion, to the same responsible set
-- that already receives submission notices. Preserve every role, branch and portfolio predicate.
do $$ declare definition text;needle text;begin
 definition:=pg_get_functiondef('private.record_operational_workflow_event()'::regprocedure);
 needle:='new.status=''submitted'' and exists(select 1 from public.user_role_assignments g';
 if position(needle in definition)=0 then raise exception 'Recipient definition changed; review required.';end if;
 execute replace(definition,needle,'exists(select 1 from public.user_role_assignments g');
end $$;
