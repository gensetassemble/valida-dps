-- Preserve reviewed aliases without global mutation triggers.
alter table public.employee_directory add column merged_into_employee_id uuid,add column merged_at timestamptz,add column merge_reason text,
 add foreign key(merged_into_employee_id,branch_code) references public.employee_directory(id,branch_code),
 add check(merged_into_employee_id is null or merged_into_employee_id<>id);
create index employee_directory_merge_target on public.employee_directory(merged_into_employee_id,branch_code);
create view public.employee_directory_records with(security_invoker=true) as select e.* from public.employee_directory e where merged_into_employee_id is null;
revoke all on public.employee_directory_records from public,anon;
grant select on public.employee_directory_records to authenticated;
