-- Preserve authorization actors and prevent ordinary AM payloads from moving portfolio ownership.
create function private.guard_authorization_metadata() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='user_role_assignments' then
  if tg_op='UPDATE' then
   new.granted_at:=old.granted_at; new.granted_by:=old.granted_by;
  end if;
 elsif tg_table_name='profiles' then
  if tg_op='UPDATE' then new.activated_at:=old.activated_at; new.activated_by:=old.activated_by; end if;
 elsif tg_table_name='clients' then
  if tg_op='UPDATE' and auth.uid() is not null then
   if new.portfolio_id is distinct from old.portfolio_id and not private.has_role(new.branch_code,array['admin']) then
    raise exception 'Pengalihan portofolio pelanggan memerlukan administrator cabang.' using errcode='42501';
   end if;
  end if;
 elsif tg_table_name='employee_portfolio_assignments' then
  if tg_op='UPDATE' and new.assignment_type<>old.assignment_type then
   raise exception 'Buat penugasan baru untuk perubahan jenis tanggung jawab.' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_authorization_metadata() from public,anon,authenticated;
create trigger guard_authorization_metadata before insert or update on public.user_role_assignments for each row execute function private.guard_authorization_metadata();
create trigger guard_authorization_metadata before insert or update on public.profiles for each row execute function private.guard_authorization_metadata();
create trigger guard_authorization_metadata before insert or update on public.clients for each row execute function private.guard_authorization_metadata();
create trigger guard_authorization_metadata before insert or update on public.employee_portfolio_assignments for each row execute function private.guard_authorization_metadata();
