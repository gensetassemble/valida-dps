-- Keep internal pilot runs small even if many real records are approaching expiry.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.enqueue_due_email_reminders(text)'::regprocedure);
 if strpos(definition,'if n>=100 then return n;')=0 then raise exception 'Expected reminder batch guard missing';end if;
 execute replace(definition,'if n>=100 then return n;','if n>=(case when delivery_mode=''test'' then 3 else 100 end) then return n;');
end $migration$;
