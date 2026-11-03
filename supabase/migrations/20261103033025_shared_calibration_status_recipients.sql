-- Deliver every transition to the same scoped PTK recipients as the submission.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('private.record_simple_calibration_event()'::regprocedure);
 if position('new.status=''submitted'' and private.target_has_role' in definition)=0 then
  raise exception 'Expected scoped recipient predicate not found';
 end if;
 definition:=replace(definition,'new.status=''submitted'' and private.target_has_role','private.target_has_role');
 definition:=replace(definition,'when ''completed'' then ''Selesai'' else new.status','when ''completed'' then ''Selesai'' when ''cancelled'' then ''Dibatalkan'' else new.status');
 execute definition;
end $$;
