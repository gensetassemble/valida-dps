-- Infrastructure only: no client, personnel, equipment or reminder tables.
create table public.branches (
  branch_code text primary key check (branch_code ~ '^[A-Z0-9]{2,8}$'),
  name text not null,
  timezone text not null default 'Asia/Makassar'
);
create table public.roles (
  code text primary key,
  name text not null
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  branch_code text not null references public.branches(branch_code),
  role_code text not null default 'member' references public.roles(code),
  display_name text,
  is_active boolean not null default false,
  activated_at timestamptz,
  activated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint activation_timestamp_required check (not is_active or activated_at is not null)
);
create index profiles_branch_code_idx on public.profiles(branch_code);
create index profiles_role_code_idx on public.profiles(role_code);
create index profiles_activated_by_idx on public.profiles(activated_by);

alter table public.branches enable row level security;
alter table public.roles enable row level security;
alter table public.profiles enable row level security;
revoke all on public.branches, public.roles, public.profiles from public, anon, authenticated;
grant select on public.branches, public.roles, public.profiles to authenticated;
grant all on public.branches, public.roles, public.profiles to service_role;

-- A newly created Auth identity receives no profile, branch or role automatically.
-- All provisioning/activation requires an authorized administrator's reviewed operation.
create policy profiles_read_active_self on public.profiles for select to authenticated
  using (id = (select auth.uid()) and is_active);
create policy branches_read_own on public.branches for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active and p.branch_code = branches.branch_code));
create policy roles_read_assigned on public.roles for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active and p.role_code = roles.code));

insert into public.branches(branch_code, name) values ('DPS', 'PT SUCOFINDO Cabang Denpasar');
insert into public.roles(code, name) values ('member', 'Pengguna'), ('admin', 'Administrator');

-- Private authorization audit. No API exposure or client write access.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.profile_authorization_audit (
  id bigint generated always as identity primary key,
  profile_id uuid not null,
  operation text not null,
  actor_id uuid,
  database_actor text not null,
  old_values jsonb,
  new_values jsonb,
  occurred_at timestamptz not null default now()
);
alter table private.profile_authorization_audit enable row level security;
revoke all on private.profile_authorization_audit from public, anon, authenticated;
create function private.audit_profile_authorization() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.profile_authorization_audit(profile_id, operation, actor_id, database_actor, old_values, new_values)
  values (coalesce(new.id, old.id), tg_op, auth.uid(), session_user,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end;
$$;
revoke all on function private.audit_profile_authorization() from public, anon, authenticated;
create trigger profile_authorization_audit after insert or update or delete on public.profiles
  for each row execute function private.audit_profile_authorization();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('certificate-documents', 'certificate-documents', false, 10485760, array['application/pdf']);
-- Restrictive policy keeps this bucket closed even if another permissive policy is added later.
create policy certificate_documents_closed on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'certificate-documents')
  with check (bucket_id <> 'certificate-documents');
