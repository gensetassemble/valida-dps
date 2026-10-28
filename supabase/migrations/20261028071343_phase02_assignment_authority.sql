-- HRGA manages personnel membership. Assignments that expand monitoring/asset authority
-- require branch Admin approval, including for an account with combined HRGA/other roles.
drop policy portfolios_assign_insert on public.employee_portfolio_assignments;
drop policy portfolios_assign_edit on public.employee_portfolio_assignments;
create policy portfolios_assign_insert on public.employee_portfolio_assignments for insert to authenticated
 with check(private.has_role(branch_code,array['admin']) or (assignment_type='personnel' and private.has_role(branch_code,array['hrga'])));
create policy portfolios_assign_edit on public.employee_portfolio_assignments for update to authenticated
 using(private.has_role(branch_code,array['admin']) or (assignment_type='personnel' and private.has_role(branch_code,array['hrga'])))
 with check(private.has_role(branch_code,array['admin']) or (assignment_type='personnel' and private.has_role(branch_code,array['hrga'])));

-- Profile email is copied from the explicitly selected Auth UUID, never guessed or changed in Auth.
create function private.guard_profile_email() returns trigger language plpgsql security definer set search_path='' as $$
declare actual_email text;
begin
 select email into actual_email from auth.users where id=new.id;
 if new.email is not null then
  if tg_op='INSERT' then
   if lower(trim(new.email)) is distinct from lower(actual_email) then raise exception 'Email profil tidak sesuai akun Auth yang dipilih.' using errcode='23514'; end if;
  elsif new.email is distinct from old.email and lower(trim(new.email)) is distinct from lower(actual_email) then
   raise exception 'Email profil tidak sesuai akun Auth yang dipilih.' using errcode='23514';
  end if;
 end if;
 new.email:=actual_email;
 return new;
end $$;
revoke all on function private.guard_profile_email() from public,anon,authenticated;
create trigger guard_profile_email before insert or update on public.profiles for each row execute function private.guard_profile_email();
