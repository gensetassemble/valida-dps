-- Authorization/provenance fields are server-owned even for direct PostgREST payloads.
create function private.guard_operational_provenance() returns trigger language plpgsql security invoker set search_path='' as $$
declare parent_example boolean;
begin
 if tg_table_name in ('clients','client_certificates') then
  if tg_op='UPDATE' and new.is_example is distinct from old.is_example and current_user in ('authenticated','anon') then
   raise exception 'Label contoh tidak dapat dipromosikan melalui aplikasi.' using errcode='42501';
  end if;
  if tg_table_name='clients' and tg_op='INSERT' and current_user in ('authenticated','anon') then new.is_example:=starts_with(new.name,'[CONTOH]');end if;
  if tg_table_name='client_certificates' then
   select is_example into parent_example from public.clients where id=new.client_id and branch_code=new.branch_code;
   if parent_example then new.is_example:=true;end if;
  end if;
 end if;
 if tg_table_name in ('client_certificates','personnel_certificates','calibrations') and current_user in ('authenticated','anon') then
  if tg_op='INSERT' then
   if new.source_import_row_id is not null then raise exception 'Provenance impor hanya ditetapkan eksekutor impor.' using errcode='42501';end if;
  elsif new.source_import_row_id is distinct from old.source_import_row_id then raise exception 'Provenance impor tidak dapat diganti.' using errcode='42501';end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_operational_provenance() from public,anon,authenticated;
create trigger ab_client_provenance before insert or update on public.clients for each row execute function private.guard_operational_provenance();
create trigger ac_certificate_provenance before insert or update on public.client_certificates for each row execute function private.guard_operational_provenance();
create trigger ab_personnel_provenance before insert or update on public.personnel_certificates for each row execute function private.guard_operational_provenance();
create trigger ac_calibration_provenance before insert or update on public.calibrations for each row execute function private.guard_operational_provenance();
create function private.stamp_operational_actor() returns trigger language plpgsql security invoker set search_path='' as $$
begin if auth.uid() is not null then new.created_by:=auth.uid();end if;new.created_at:=now();return new;end $$;
revoke all on function private.stamp_operational_actor() from public,anon,authenticated;
create trigger stamp_document_actor before insert on public.operational_documents for each row execute function private.stamp_operational_actor();
create trigger stamp_correction_actor before insert on public.personnel_correction_requests for each row execute function private.stamp_operational_actor();
alter table public.operational_documents add constraint evidence_kind_domain check(domain='client' or kind='certificate');
