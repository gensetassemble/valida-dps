-- Only reviewed Super Admin sessions at AAL2 can administer accounts/roles.
create or replace function private.has_role(b text,wanted text[]) returns boolean
language sql stable security definer set search_path='' as $$
 select private.actor_enabled() and exists(
 select 1 from public.user_role_assignments a
 join public.roles r on r.code=a.role_code and r.is_active
 join public.branches br on br.code=a.branch_code and br.is_active
 where a.profile_id=auth.uid() and a.branch_code=b and a.is_active and a.revoked_at is null
 and (a.role_code not in ('admin','super_admin') or (select auth.jwt()->>'aal')='aal2')
 and (a.role_code=any(wanted)
 or (a.role_code='super_admin' and 'admin'=any(wanted))
 or (a.role_code in ('tester','department_head','unit_head') and 'branch_head'=any(wanted))));
$$;
alter policy grants_insert on public.user_role_assignments with check(profile_id<>auth.uid() and private.has_role(branch_code,array['super_admin']));
alter policy grants_edit on public.user_role_assignments using(profile_id<>auth.uid() and private.has_role(branch_code,array['super_admin'])) with check(profile_id<>auth.uid() and private.has_role(branch_code,array['super_admin']));
alter policy profiles_insert on public.profiles with check(id<>auth.uid() and private.has_role(branch_code,array['super_admin']));
alter policy profiles_edit on public.profiles using(id<>auth.uid() and private.has_role(branch_code,array['super_admin'])) with check(id<>auth.uid() and private.has_role(branch_code,array['super_admin']));

-- Trigger also protects definer paths and future policies. Trusted bootstrap
-- without an Auth actor remains available only to database/service operators.
create function private.guard_account_administration() returns trigger
language plpgsql set search_path='' as $$
begin
 if auth.uid() is null and current_user in ('postgres','supabase_admin','service_role') then return new;end if;
 if not private.has_role(new.branch_code,array['super_admin']) then
  raise exception 'Super Admin dan verifikasi MFA diperlukan.' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function private.guard_account_administration() from public,anon,authenticated;
create trigger a_account_administration before insert or update on public.profiles for each row execute function private.guard_account_administration();
create trigger a_account_administration before insert or update on public.user_role_assignments for each row execute function private.guard_account_administration();

-- Recovery is established by Auth, not by editable PKCE redirectType cookies.
create function private.password_recovery_session() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from auth.sessions s join auth.mfa_amr_claims m on m.session_id=s.id
  where s.id::text=(select auth.jwt()->>'session_id') and s.user_id=auth.uid()
  and s.created_at>now()-interval '15 minutes'
  and (s.not_after is null or s.not_after>now())
  and m.authentication_method='recovery');
$$;
revoke all on function private.password_recovery_session() from public,anon;
grant execute on function private.password_recovery_session() to authenticated;
create function public.password_recovery_session() returns boolean
language sql stable security invoker set search_path='' as $$select private.password_recovery_session();$$;
revoke all on function public.password_recovery_session() from public,anon;
grant execute on function public.password_recovery_session() to authenticated;
