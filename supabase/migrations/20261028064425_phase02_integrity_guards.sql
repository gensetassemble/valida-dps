-- A referenced certificate category cannot be rewritten underneath historical records.
create function private.guard_certificate_category() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.category<>old.category and (
  exists(select 1 from public.client_certificates where certificate_type_id=old.id)
  or exists(select 1 from public.personnel_certificates where certificate_type_id=old.id)
  or exists(select 1 from public.service_competency_requirements where certificate_type_id=old.id)
 ) then raise exception 'Kategori yang telah dipakai pada riwayat tidak dapat diubah.' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function private.guard_certificate_category() from public,anon,authenticated;
create trigger guard_certificate_category before update on public.certificate_types for each row execute function private.guard_certificate_category();
