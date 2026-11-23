-- Mapping responsibility is editable only through the existing HRGA/Admin certificate policy.
-- Keep every other immutable relationship and the branch FK unchanged.
do $migration$
declare definition text; original text := '(j->>''portfolio_id'' is distinct from oldj->>''portfolio_id'')';
begin
 definition := pg_get_functiondef('private.guard_record()'::regprocedure);
 if strpos(definition,original)=0 then raise exception 'Expected immutable relationship guard is missing'; end if;
 definition := replace(definition, original, '(tg_table_name<>''personnel_certificates'' and ' || original || ')');
 execute definition;
end $migration$;
