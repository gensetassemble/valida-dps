-- Isolated training workspace on the primary site. No DPS grants or rows are changed.
create table public.simulation_workspaces(
 profile_id uuid primary key references public.profiles(id),
 branch_code text not null unique references public.branches(code) check(branch_code='SIMDPS'),
 is_active boolean not null default true
);
alter table public.simulation_workspaces enable row level security;
revoke all on public.simulation_workspaces from public,anon,authenticated;
grant select on public.simulation_workspaces to authenticated;
create policy simulation_workspace_self on public.simulation_workspaces for select to authenticated using(profile_id=(select auth.uid()));

create function private.simulation_actor(b text) returns boolean language sql stable security definer set search_path='' as $$
 select b='SIMDPS' and private.has_role(b,array['super_admin']) and exists(
 select 1 from public.simulation_workspaces w where w.profile_id=auth.uid() and w.branch_code=b and w.is_active);
$$;
revoke all on function private.simulation_actor(text) from public,anon;
grant execute on function private.simulation_actor(text) to authenticated;

-- Fake user identities/roles are separate from profiles, Auth and real permissions.
create table public.simulation_profiles(
 id uuid primary key default gen_random_uuid(),branch_code text not null references public.branches(code) check(branch_code='SIMDPS'),
 employee_id uuid,full_name text not null,email text not null,npp text,whatsapp text,is_active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,branch_code),unique(branch_code,email),
 foreign key(employee_id,branch_code) references public.employee_directory(id,branch_code)
);
create table public.simulation_role_assignments(
 id uuid primary key default gen_random_uuid(),profile_id uuid not null,branch_code text not null references public.branches(code) check(branch_code='SIMDPS'),
 role_code text not null references public.roles(code),grant_reason text not null check(length(trim(grant_reason))>=8),is_active boolean not null default true,
 granted_at timestamptz not null default now(),revoked_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(profile_id,branch_code) references public.simulation_profiles(id,branch_code),unique(profile_id,branch_code,role_code)
);
alter table public.simulation_profiles enable row level security;
alter table public.simulation_role_assignments enable row level security;
revoke all on public.simulation_profiles,public.simulation_role_assignments from public,anon,authenticated;
grant select,insert,update on public.simulation_profiles,public.simulation_role_assignments to authenticated;
create policy simulation_profiles_read on public.simulation_profiles for select to authenticated using(private.simulation_actor(branch_code));
create policy simulation_profiles_insert on public.simulation_profiles for insert to authenticated with check(private.simulation_actor(branch_code));
create policy simulation_profiles_update on public.simulation_profiles for update to authenticated using(private.simulation_actor(branch_code)) with check(private.simulation_actor(branch_code));
create policy simulation_roles_read on public.simulation_role_assignments for select to authenticated using(private.simulation_actor(branch_code));
create policy simulation_roles_insert on public.simulation_role_assignments for insert to authenticated with check(private.simulation_actor(branch_code));
create policy simulation_roles_update on public.simulation_role_assignments for update to authenticated using(private.simulation_actor(branch_code)) with check(private.simulation_actor(branch_code));
create view public.simulation_profile_records with(security_invoker=true) as select p.*,e.full_name as employee_name from public.simulation_profiles p left join public.employee_directory e on e.id=p.employee_id and e.branch_code=p.branch_code;
create view public.simulation_role_records with(security_invoker=true) as select a.*,p.full_name as profile_name,r.name as role_name from public.simulation_role_assignments a join public.simulation_profiles p on p.id=a.profile_id and p.branch_code=a.branch_code join public.roles r on r.code=a.role_code;
grant select on public.simulation_profile_records,public.simulation_role_records to authenticated;
create function private.guard_simulation_record() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.id<>old.id or new.branch_code<>old.branch_code then raise exception 'Identitas dan ruang simulasi tidak boleh diubah.' using errcode='42501';end if;
  new.created_at:=old.created_at;
 end if;
 new.updated_at:=now();
 if tg_table_name='simulation_role_assignments' then
  if tg_op='UPDATE' and (new.profile_id<>old.profile_id or new.role_code<>old.role_code) then raise exception 'Buat penugasan simulasi baru untuk mengganti identitas.';end if;
  if new.is_active then new.revoked_at:=null;else new.revoked_at:=now();end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_simulation_record() from public,anon,authenticated;
create trigger guard_simulation_record before insert or update on public.simulation_profiles for each row execute function private.guard_simulation_record();
create trigger guard_simulation_record before insert or update on public.simulation_role_assignments for each row execute function private.guard_simulation_record();
create trigger audit_business_record after insert or update on public.simulation_profiles for each row execute function private.audit_business_record();
create trigger audit_business_record after insert or update on public.simulation_role_assignments for each row execute function private.audit_business_record();

-- App routing alone is insufficient: deny real identity/grant mutations from a
-- workspace member, including direct calls to the Data API / privileged RPCs.
create function private.guard_simulation_identity() returns trigger language plpgsql security definer set search_path='' as $$
declare b text;
begin
 b:=case when tg_op='DELETE' then old.branch_code else new.branch_code end;
 if auth.uid() is not null and exists(select 1 from public.simulation_workspaces where profile_id=auth.uid() and is_active) then
  raise exception 'Akun simulasi tidak boleh mengubah identitas atau hak akses nyata. Gunakan pengguna simulasi.' using errcode='42501';
 end if;
 return coalesce(new,old);
end $$;
revoke all on function private.guard_simulation_identity() from public,anon,authenticated;
create trigger aa_simulation_identity before insert or update or delete on public.profiles for each row execute function private.guard_simulation_identity();
create trigger aa_simulation_identity before insert or update or delete on public.user_role_assignments for each row execute function private.guard_simulation_identity();

create function private.guard_simulation_email() returns trigger language plpgsql set search_path='' as $$
begin
 if new.branch_code='SIMDPS' then raise exception 'Mode simulasi tidak mengirim email sungguhan.' using errcode='P0001';end if;
 return new;
end $$;
revoke all on function private.guard_simulation_email() from public,anon,authenticated;
-- The outbox is present in development; production rollout may precede email activation.
do $$declare t text;begin foreach t in array array['email_deliveries','email_outbox'] loop
 if to_regclass('public.'||t) is not null then
  execute format('create trigger aa_simulation_no_email before insert or update on public.%I for each row execute function private.guard_simulation_email()',t);
 end if;
end loop;end $$;
