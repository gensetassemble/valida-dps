create table public.operational_coordinators (
 id uuid primary key default gen_random_uuid(),
 branch_code text not null references public.branches(code),
 full_name text not null check(length(trim(full_name)) between 2 and 160),
 email text check(email is null or length(email)<=254),
 whatsapp text check(whatsapp is null or length(whatsapp)<=40),
 coverage text check(coverage is null or length(coverage)<=500),
 notes text check(notes is null or length(notes)<=2000),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),created_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),updated_by uuid references auth.users(id) on delete set null,
 unique(branch_code,full_name)
);
alter table public.operational_coordinators enable row level security;
revoke all on public.operational_coordinators from public,anon,authenticated;
grant select,insert,update on public.operational_coordinators to authenticated;
create policy operational_coordinators_read on public.operational_coordinators for select to authenticated using(private.branch_access(branch_code));
create policy operational_coordinators_insert on public.operational_coordinators for insert to authenticated with check(private.has_role(branch_code,array['admin']));
create policy operational_coordinators_update on public.operational_coordinators for update to authenticated using(private.has_role(branch_code,array['admin'])) with check(private.has_role(branch_code,array['admin']));
create trigger guard_record before insert or update on public.operational_coordinators for each row execute function private.guard_record();
create trigger audit_business_record after insert or update or delete on public.operational_coordinators for each row execute function private.audit_business_record();
