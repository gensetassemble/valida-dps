create table private.bulk_initial_passwords (
 profile_id uuid primary key references auth.users(id) on delete cascade,
 created_by uuid not null,
 created_at timestamptz not null default now()
);
alter table private.bulk_initial_passwords enable row level security;
revoke all on private.bulk_initial_passwords from public,anon,authenticated;

create function public.initial_password_change_required() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from private.bulk_initial_passwords x where x.profile_id=auth.uid());
$$;
revoke all on function public.initial_password_change_required() from public,anon;
grant execute on function public.initial_password_change_required() to authenticated;

create function private.mark_bulk_initial_password(p uuid,b text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.actor_enabled() or not private.has_role(b,array['super_admin']) or coalesce(auth.jwt()->>'aal','')<>'aal2' or p=auth.uid()
 or not exists(select 1 from public.profiles x where x.id=p and x.branch_code=b and x.created_by=auth.uid() and x.created_at>now()-interval '5 minutes') then
 raise exception 'Bulk provisioning denied' using errcode='42501';end if;
 insert into private.bulk_initial_passwords(profile_id,created_by) values(p,auth.uid());
end $$;
revoke all on function private.mark_bulk_initial_password(uuid,text) from public,anon;
grant execute on function private.mark_bulk_initial_password(uuid,text) to authenticated;

create function public.provision_bulk_user(b text,details jsonb,role_codes text[]) returns uuid
language plpgsql security invoker set search_path='' as $$
declare p uuid;code text;e public.employee_directory;
begin
 if not private.actor_enabled() or not private.has_role(b,array['super_admin']) or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Bulk provisioning denied' using errcode='42501';end if;
 if cardinality(role_codes) not between 1 and 5 or cardinality(role_codes)<>(select count(distinct x) from unnest(role_codes) x) then raise exception 'Invalid roles' using errcode='23514';end if;
 select * into e from public.employee_directory where id=(details->>'employee_id')::uuid and branch_code=b and employment_status='active' and is_active and archived_at is null and merged_into_employee_id is null for share;
 if not found or exists(select 1 from public.profiles where employee_id=e.id and branch_code=b and retired_at is null) then raise exception 'Employee unavailable or already linked' using errcode='23514';end if;
 if 'coordinator'=any(role_codes) and not exists(select 1 from public.portfolio_coordinators pc where pc.employee_id=e.id and pc.branch_code=b and pc.is_active and pc.effective_from<=(now() at time zone 'Asia/Makassar')::date and (pc.effective_until is null or pc.effective_until>=(now() at time zone 'Asia/Makassar')::date)) then raise exception 'Coordinator portfolio assignment required' using errcode='23514';end if;
 p:=public.save_profile_identity(b,null,details||jsonb_build_object('is_active',false));
 foreach code in array role_codes loop
  insert into public.user_role_assignments(profile_id,branch_code,role_code,grant_reason,is_active)
   values(p,b,code,'Pembuatan akun massal melalui pratinjau Super Admin',true);
 end loop;
 update public.profiles set is_active=true where id=p and branch_code=b;
 perform private.mark_bulk_initial_password(p,b);
 return p;
end $$;
revoke all on function public.provision_bulk_user(text,jsonb,text[]) from public,anon;
grant execute on function public.provision_bulk_user(text,jsonb,text[]) to authenticated;

-- Password changes are acknowledged by Auth itself, never a client-writable flag.
create function private.clear_bulk_initial_password() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.encrypted_password is distinct from old.encrypted_password then
  delete from private.bulk_initial_passwords where profile_id=new.id;
 end if;
 return new;
end $$;
revoke all on function private.clear_bulk_initial_password() from public,anon,authenticated;
create trigger clear_bulk_initial_password after update of encrypted_password on auth.users
 for each row execute function private.clear_bulk_initial_password();

-- Retain all current lifecycle predicates, adding the first-login restriction.
do $$ declare definition text;needle text;begin
 definition:=pg_get_functiondef('private.actor_enabled()'::regprocedure);
 needle:='select auth.uid() is not null and';
 if position(needle in definition)=0 then raise exception 'Actor definition changed; review required';end if;
 execute replace(definition,needle,'select auth.uid() is not null and not exists(select 1 from private.bulk_initial_passwords x where x.profile_id=auth.uid()) and');
end $$;
