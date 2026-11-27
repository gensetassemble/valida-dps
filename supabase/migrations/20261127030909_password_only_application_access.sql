-- Password-only sign-in applies to every application role. Existing active
-- account, branch, assignment and record-level permissions remain authoritative.
create or replace function private.has_role(b text,wanted text[]) returns boolean
language sql stable security definer set search_path='' as $$
 select private.actor_enabled() and exists(
 select 1 from public.user_role_assignments a
 join public.roles r on r.code=a.role_code and r.is_active
 join public.branches br on br.code=a.branch_code and br.is_active
 where a.profile_id=auth.uid() and a.branch_code=b and a.is_active and a.revoked_at is null
 and (a.role_code=any(wanted)
 or (a.role_code='super_admin' and 'admin'=any(wanted))
 or (a.role_code in ('tester','department_head','unit_head') and 'branch_head'=any(wanted))));
$$;
-- Keep the current bulk provisioning rules; remove only the assurance-level gate.
do $$ declare signature text; definition text; gate text:=' or coalesce(auth.jwt()->>''aal'','''')<>''aal2'''; begin
 foreach signature in array array['private.mark_bulk_initial_password(uuid,text)','public.provision_bulk_user(text,jsonb,text[])'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if position(gate in definition)=0 then raise exception 'Unexpected MFA gate in %',signature;end if;
  execute replace(definition,gate,'');
 end loop;
 definition:=pg_get_functiondef('private.guard_account_administration()'::regprocedure);
 execute replace(definition,'Super Admin dan verifikasi MFA diperlukan.','Hanya Super Admin yang berwenang mengelola akun.');
end $$;
