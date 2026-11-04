begin;
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
insert into public.branches(code,name) values('CAL','[CONTOH] Label other branch');
insert into auth.users(id,email) select ('bf110000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'account-label-qa-'||i||'@example.invalid' from generate_series(1,3)i;
insert into public.profiles(id,branch_code,full_name,is_active) select ('bf110000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=3 then 'CAL' else 'DPS' end,'[CONTOH] Account Label '||i,true from generate_series(1,3)i;
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason) select ('bf110000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=3 then 'CAL' else 'DPS' end,'account_manager','[CONTOH] rollback label test' from generate_series(1,3)i;
insert into public.clients(id,branch_code,name,account_manager_id) values
 ('bf220000-0000-4000-8000-000000000001','DPS','[CONTOH] Label Customer','bf110000-0000-4000-8000-000000000002'),
 ('bf220000-0000-4000-8000-000000000002','CAL','[CONTOH] Other Label Customer','bf110000-0000-4000-8000-000000000003');
select set_config('request.jwt.claim.sub','bf110000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$begin
 if not exists(select 1 from public.client_directory_records where id='bf220000-0000-4000-8000-000000000001' and account_manager_label='[CONTOH] Account Label 2') then raise exception 'FAIL assigned account label';end if;
 if exists(select 1 from public.profiles where id='bf110000-0000-4000-8000-000000000002') then raise exception 'FAIL profile details exposed';end if;
 if exists(select 1 from public.client_directory_records where branch_code='CAL') then raise exception 'FAIL cross branch view';end if;
 if private.client_account_label('CAL','bf220000-0000-4000-8000-000000000002') is not null then raise exception 'FAIL cross branch label';end if;
 if has_function_privilege('anon','private.client_account_label(text,uuid)','EXECUTE') then raise exception 'FAIL anonymous access';end if;
end $$;
reset role;
select 'PASS: assigned account name visible, profile details private, customer/branch scopes preserved' as result;
rollback;
