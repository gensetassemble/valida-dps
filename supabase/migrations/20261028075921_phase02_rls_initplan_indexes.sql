-- Preserve authorization predicates while evaluating the request identity once per query.
alter policy profiles_read on public.profiles using (
 (select private.actor_enabled()) and (id=(select auth.uid()) or private.has_role(branch_code,array['admin']))
);
alter policy profiles_insert on public.profiles with check (
 id<>(select auth.uid()) and private.has_role(branch_code,array['admin'])
);
alter policy profiles_edit on public.profiles using (
 id<>(select auth.uid()) and private.has_role(branch_code,array['admin'])
) with check (
 id<>(select auth.uid()) and private.has_role(branch_code,array['admin'])
);
alter policy grants_read on public.user_role_assignments using (
 (select private.actor_enabled()) and (profile_id=(select auth.uid()) or private.has_role(branch_code,array['admin']))
);
alter policy grants_insert on public.user_role_assignments with check (
 profile_id<>(select auth.uid()) and private.has_role(branch_code,array['admin'])
);
alter policy grants_edit on public.user_role_assignments using (
 profile_id<>(select auth.uid()) and private.has_role(branch_code,array['admin'])
) with check (
 profile_id<>(select auth.uid()) and private.has_role(branch_code,array['admin'])
);
alter policy clients_insert on public.clients with check (
 private.has_role(branch_code,array['admin']) or
 (private.has_role(branch_code,array['account_manager']) and account_manager_id=(select auth.uid()))
);
create index if not exists certificate_types_branch_idx on public.certificate_types(branch_code);
