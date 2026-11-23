-- Revalidate the initiating account's lifecycle and test-send privilege at dispatch.
do $migration$
declare definition text; original text:='and g.role_code in (''super_admin'',''admin'',''account_manager''));';
begin
 definition:=pg_get_functiondef('public.claim_email_deliveries(integer,text,uuid)'::regprocedure);
 if strpos(definition,original)=0 then raise exception 'Expected actor guard missing';end if;
 execute replace(definition,original,'and g.role_code in (''super_admin'',''admin'',''account_manager'')
  and (o.mode<>''test'' or g.role_code in (''super_admin'',''admin''))
  and not exists(select 1 from public.employee_directory employee where employee.id=p.employee_id and employee.branch_code=p.branch_code and (employee.employment_status=''inactive'' or employee.archived_at is not null)));');
end $migration$;
