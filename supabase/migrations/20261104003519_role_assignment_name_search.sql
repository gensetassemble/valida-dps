-- The login guard joins the user's own grants to active branch metadata before MFA.
-- Allow only that metadata at AAL1; privileged business capabilities still require AAL2.
alter policy branches_read on public.branches using (
 private.branch_access(code) or (
  is_active and private.actor_enabled() and exists (
   select 1 from public.user_role_assignments a
   join public.roles r on r.code=a.role_code and r.is_active
   where a.profile_id=(select auth.uid()) and a.branch_code=branches.code
   and a.is_active and a.revoked_at is null
  )
 )
);

-- Search visible account/role labels, while retaining the caller's table RLS.
create view public.role_assignment_records with (security_invoker=true) as
 select a.*,p.full_name as profile_name,r.name as role_name
 from public.user_role_assignments a
 join public.profiles p on p.id=a.profile_id
 join public.roles r on r.code=a.role_code;
revoke all on public.role_assignment_records from public,anon,authenticated;
grant select on public.role_assignment_records to authenticated;
