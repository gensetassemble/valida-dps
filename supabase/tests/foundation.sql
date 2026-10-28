-- Transaction-only synthetic UUIDs; no email, password, employee or client data.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);
insert into auth.users(id) values
 ('10000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002'),
 ('10000000-0000-4000-8000-000000000003');
insert into public.branches(branch_code,name) values ('TEST','Isolasi Pengujian');
insert into public.profiles(id,branch_code,is_active,activated_at) values
 ('10000000-0000-4000-8000-000000000001','DPS',true,now()),
 ('10000000-0000-4000-8000-000000000002','TEST',true,now()),
 ('10000000-0000-4000-8000-000000000003','DPS',false,null);
-- Metadata only; no PDF bytes or real document is uploaded.
insert into storage.objects(bucket_id,name) values ('certificate-documents','rls-test-metadata.pdf');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ begin
 if (select count(*) from public.profiles) <> 1 then raise exception 'FAIL: own active profile'; end if;
 if (select count(*) from public.branches) <> 1 then raise exception 'FAIL: branch isolation'; end if;
 if exists(select 1 from public.branches where branch_code <> 'DPS') then raise exception 'FAIL: cross-branch read'; end if;
 if exists(select 1 from public.roles where code = 'admin') then raise exception 'FAIL: unassigned role'; end if;
 if (select count(*) from public.roles where code='member') <> 1 then raise exception 'FAIL: assigned role read'; end if;
 begin
  update public.profiles set role_code='admin' where id=auth.uid();
  raise exception 'FAIL: role escalation allowed';
 exception when insufficient_privilege then null; end;
 begin
  update public.profiles set branch_code='TEST' where id=auth.uid();
  raise exception 'FAIL: branch reassignment allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.branches(branch_code,name) values ('BAD','Denied');
  raise exception 'FAIL: organization write allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.profiles(id,branch_code,role_code,is_active,activated_at)
  values ('10000000-0000-4000-8000-000000000004','DPS','admin',true,now());
  raise exception 'FAIL: privileged profile insert allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into storage.objects(bucket_id,name) values ('certificate-documents','denied.pdf');
  raise exception 'FAIL: document upload allowed';
 exception when insufficient_privilege then null; end;
 if exists(select 1 from storage.objects where bucket_id='certificate-documents') then raise exception 'FAIL: private storage read'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$ begin
 if exists(select 1 from public.profiles) then raise exception 'FAIL: inactive profile read'; end if;
 if exists(select 1 from public.branches) then raise exception 'FAIL: inactive branch read'; end if;
 begin
  update public.profiles set is_active=true, activated_at=now() where id=auth.uid();
  raise exception 'FAIL: self activation allowed';
 exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin
  perform * from public.profiles;
  raise exception 'FAIL: anonymous profiles read';
 exception when insufficient_privilege then null; end;
 begin
  insert into storage.objects(bucket_id,name) values ('certificate-documents','anonymous.pdf');
  raise exception 'FAIL: anonymous upload allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from storage.buckets where id='certificate-documents' and not public and allowed_mime_types=array['application/pdf'] and file_size_limit=10485760) then raise exception 'FAIL: private PDF bucket'; end if;
 if not exists(select 1 from private.profile_authorization_audit where profile_id='10000000-0000-4000-8000-000000000001') then raise exception 'FAIL: provisioning audit'; end if;
end $$;
select pass('Profile, branch, role, activation, audit and private storage authorization');
select * from finish();
rollback;
