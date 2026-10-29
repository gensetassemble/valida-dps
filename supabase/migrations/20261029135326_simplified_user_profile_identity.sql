create view public.profile_identity_records with(security_invoker=true) as
select p.*,e.npp from public.profiles p left join public.employee_directory e on e.id=p.employee_id and e.branch_code=p.branch_code;
revoke all on public.profile_identity_records from public,anon;
grant select on public.profile_identity_records to authenticated;

create function private.profile_auth_id(b text,mail text) returns uuid language plpgsql stable security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null or not private.has_role(b,array['admin']) then raise exception 'Profile access denied' using errcode='42501';end if;
 select id into result from auth.users where lower(email)=lower(trim(mail));
 if result is null then raise exception 'Email belum memiliki akun login. Sediakan akun terlebih dahulu.' using errcode='P0001';end if;
 return result;
end $$;
revoke all on function private.profile_auth_id(text,text) from public,anon;
grant execute on function private.profile_auth_id(text,text) to authenticated;

create function public.save_profile_identity(b text,profile uuid,details jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare uid uuid;emp uuid;existing public.profiles;number text;
begin
 if auth.uid() is null or not private.has_role(b,array['admin']) then raise exception 'Profile access denied' using errcode='42501';end if;
 if jsonb_typeof(details) is distinct from 'object' or exists(select 1 from jsonb_object_keys(details) k where k not in ('full_name','email','npp','whatsapp','is_active')) then raise exception 'Invalid identity fields' using errcode='23514';end if;
 if length(trim(coalesce(details->>'full_name',''))) not between 2 and 160 or length(coalesce(details->>'email',''))>254 then raise exception 'Invalid identity' using errcode='23514';end if;
 uid:=private.profile_auth_id(b,details->>'email');
 if profile is not null then
  select * into existing from public.profiles where id=profile and branch_code=b for update;
  if not found or profile=auth.uid() then raise exception 'Profile edit denied' using errcode='42501';end if;
  if uid<>profile then raise exception 'Email harus sesuai akun login profil ini.' using errcode='23514';end if;
 end if;
 number:=nullif(trim(details->>'npp'),'');
 if number is not null then
  select id into emp from public.employee_directory where branch_code=b and npp=number;
  if emp is null then raise exception 'NPP belum ditemukan dalam direktori cabang.' using errcode='P0001';end if;
 end if;
 if profile is null then
  insert into public.profiles(id,employee_id,branch_code,full_name,email,whatsapp,is_active)
  values(uid,emp,b,trim(details->>'full_name'),trim(details->>'email'),nullif(trim(details->>'whatsapp'),''),coalesce((details->>'is_active')::boolean,false));
 else
  update public.profiles set employee_id=emp,full_name=trim(details->>'full_name'),email=trim(details->>'email'),whatsapp=nullif(trim(details->>'whatsapp'),''),is_active=coalesce((details->>'is_active')::boolean,false) where id=profile and branch_code=b;
 end if;
 return uid;
end $$;
revoke all on function public.save_profile_identity(text,uuid,jsonb) from public,anon;
grant execute on function public.save_profile_identity(text,uuid,jsonb) to authenticated;
