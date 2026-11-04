begin;
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
insert into auth.users(id,email) select ('bc110000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'client-reference-qa-'||i||'@example.invalid' from generate_series(1,2)i;
insert into public.profiles(id,branch_code,full_name,is_active) select ('bc110000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'DPS','[CONTOH] Client reference QA '||i,true from generate_series(1,2)i;
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason) select ('bc110000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'DPS',(array['account_manager','tester'])[i],'[CONTOH] rollback authorization test' from generate_series(1,2)i;
select set_config('request.jwt.claim.sub','bc110000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$declare a uuid; repeated uuid; t uuid; begin
 select id into a from public.create_client_certificate_reference('DPS','client_id','  [UJI]   Inline Client QA  ');
 select id into repeated from public.create_client_certificate_reference('DPS','client_id','[uji] inline client qa');
 if a is null or a<>repeated then raise exception 'Client deduplication failed';end if;
 if not exists(select 1 from public.clients where id=a and account_manager_id=auth.uid() and created_by=auth.uid() and verification_status='pending') then raise exception 'Client scope/audit failed';end if;
 select id into t from public.create_client_certificate_reference('DPS','certificate_type_id',' [CONTOH]  Inline Client Type QA ');
 select id into repeated from public.create_client_certificate_reference('DPS','certificate_type_id','[contoh] inline client type qa');
 if t is null or t<>repeated then raise exception 'Type deduplication failed';end if;
 if not exists(select 1 from public.certificate_types where id=t and category='client' and created_by=auth.uid()) then raise exception 'Type scope/audit failed';end if;
 insert into public.client_certificates(branch_code,client_id,certificate_type_id,certificate_number,object_type,previous_order_value,issue_date,expiry_date,interval_months)
 values('DPS',a,t,'[CONTOH] Inline Certificate QA','Fixture',170000000,'2026-11-04','2027-11-04',12);
 begin perform public.create_client_certificate_reference('OTHER','client_id','[CONTOH] denied');raise exception 'FAIL cross branch';exception when insufficient_privilege then null;end;
 begin perform public.create_client_certificate_reference('DPS','arbitrary_table','[CONTOH] denied');raise exception 'FAIL arbitrary kind';exception when invalid_parameter_value then null;end;
 begin insert into public.certificate_types(branch_code,code,name,category) values('DPS','QA_DENIED','[CONTOH] denied personnel','personnel');raise exception 'FAIL category boundary';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','bc110000-0000-4000-8000-000000000002',true);
do $$begin
 begin perform public.create_client_certificate_reference('DPS','client_id','[CONTOH] tester denied');raise exception 'FAIL tester client write';exception when insufficient_privilege then null;end;
 begin perform public.create_client_certificate_reference('DPS','certificate_type_id','[CONTOH] tester denied');raise exception 'FAIL tester type write';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: inline creation, deduplication, certificate insertion, audit, branch/category/read-only boundaries' as result;
rollback;
