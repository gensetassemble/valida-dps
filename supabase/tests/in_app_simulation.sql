begin;
create function pg_temp.sim_assert(ok boolean,msg text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception '%',msg;end if;end $$;
insert into public.branches(code,name) values('REALQA','[UJI] Operational scope'),('SIMDPS','[UJI] Simulation');
insert into auth.users(id,email) values('ae110000-0000-4000-8000-000000000001','simulation.rollback@example.invalid');
insert into auth.users(id,email) values('ae110000-0000-4000-8000-000000000002','simulation.target@example.invalid');
insert into public.employee_directory(id,branch_code,full_name,is_active,employment_status,verification_status)
values('ae120000-0000-4000-8000-000000000001','REALQA','[UJI] Simulation operator',true,'active','verified');
insert into public.profiles(id,branch_code,employee_id,full_name,is_active)
values('ae110000-0000-4000-8000-000000000001','REALQA','ae120000-0000-4000-8000-000000000001','[UJI] Simulation operator',true);
insert into public.profiles(id,branch_code,employee_id,full_name,is_active)
values('ae110000-0000-4000-8000-000000000002','REALQA',null,'[UJI] Other actual account',true);
insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason)
select 'ae110000-0000-4000-8000-000000000001',b,r,'[UJI] Isolated simulation regression'
from (values('REALQA','tester'),('SIMDPS','super_admin'),('SIMDPS','hrga'),('SIMDPS','equipment_manager'),('SIMDPS','coordinator'),('SIMDPS','account_manager')) x(b,r);
insert into public.simulation_workspaces(profile_id,branch_code) values('ae110000-0000-4000-8000-000000000001','SIMDPS');
insert into public.equipment(id,branch_code,name) values('ae130000-0000-4000-8000-000000000001','REALQA','[UJI] Operational equipment');
select set_config('request.jwt.claim.sub','ae110000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
set local role authenticated;
update public.equipment set name='MUST NOT CHANGE' where id='ae130000-0000-4000-8000-000000000001';
select pg_temp.sim_assert((select name='[UJI] Operational equipment' from public.equipment where id='ae130000-0000-4000-8000-000000000001'),'Simulation member cannot alter operational equipment');
insert into public.equipment(branch_code,name) values('SIMDPS','[UJI] Simulated equipment');
insert into public.simulation_profiles(id,branch_code,full_name,email) values('ae140000-0000-4000-8000-000000000001','SIMDPS','[UJI] Fake account','fake@example.invalid');
insert into public.simulation_role_assignments(profile_id,branch_code,role_code,grant_reason) values('ae140000-0000-4000-8000-000000000001','SIMDPS','super_admin','[UJI] This must never grant real access');
do $$begin
 begin
  insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason) values('ae110000-0000-4000-8000-000000000002','SIMDPS','qshe','[UJI] Real grant must be blocked');
  raise exception 'Expected actual identity refusal';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$declare t text;begin
 foreach t in array array['email_outbox','email_deliveries'] loop
  if to_regclass('public.'||t) is not null then
   begin
    execute format('insert into public.%I(branch_code) values(''SIMDPS'')',t);
    raise exception 'Expected email refusal';
   exception when raise_exception then
    if sqlerrm<>'Mode simulasi tidak mengirim email sungguhan.' then raise;end if;
   end;
  end if;
 end loop;
end $$;
select pg_temp.sim_assert(not exists(select 1 from auth.users where id='ae140000-0000-4000-8000-000000000001'),'Fake profile must not create Auth user');
select pg_temp.sim_assert(not exists(select 1 from public.user_role_assignments where profile_id='ae140000-0000-4000-8000-000000000001'),'Fake grants must not enter real authorization');
select pg_temp.sim_assert(exists(select 1 from public.equipment where branch_code='SIMDPS'),'Simulation business changes are isolated');
select 'Simulation scope isolation, operational write denial, synthetic identities and real grant refusal passed' as result;
rollback;
