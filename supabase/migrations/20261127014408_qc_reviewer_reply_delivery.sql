-- Super Admin's ordinary replies follow the reviewer route. The explicit
-- request_review action remains available when acting as an operational owner.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('private.submit_certificate_qc(text,text,uuid,uuid,text,text,text,integer,uuid,uuid)'::regprocedure);
 if position('when responder then ''in_progress''' in definition)=0 or position('reviewer and not responder' in definition)=0 then
  raise exception 'QC reply definition changed; review required';
 end if;
 definition:=replace(definition,'when responder then ''in_progress''','when responder and not reviewer then ''in_progress''');
 definition:=replace(definition,'op=''reply'' and reviewer and not responder','op=''reply'' and reviewer');
 execute definition;
end $$;
