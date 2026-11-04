do $$declare definition text;begin
 definition:=rtrim(pg_get_viewdef('public.client_certificate_display_records'::regclass,true),E';\n ');
 execute 'create or replace view public.client_certificate_display_records with(security_invoker=true) as select old.*,
 (select newer.id from public.client_certificates newer where newer.previous_certificate_id=old.id and newer.branch_code=old.branch_code and newer.is_active order by newer.created_at desc,newer.id desc limit 1) as superseded_by_certificate_id
 from ('||definition||') old';
end $$;
