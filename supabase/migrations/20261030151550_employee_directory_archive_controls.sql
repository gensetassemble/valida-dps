-- Reversible directory removal; no employee, account or certificate is deleted.
alter table public.employee_directory
 add column archived_at timestamptz,
 add column archived_by uuid references public.profiles(id),
 add column archive_reason text;
create index employee_directory_archived_branch on public.employee_directory(branch_code,archived_at) where archived_at is not null;
create index employee_directory_archived_actor on public.employee_directory(archived_by);

create function private.guard_employee_directory_archive() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.archived_at is not null or new.archived_by is not null or new.archive_reason is not null then raise exception 'Buat identitas sebelum mengarsipkannya.';end if;
  return new;
 end if;
 if row(new.archived_at,new.archived_by,new.archive_reason) is not distinct from row(old.archived_at,old.archived_by,old.archive_reason) then return new;end if;
 if auth.uid() is null or not private.has_role(new.branch_code,array['super_admin']) then raise exception 'Pengelolaan arsip direktori hanya oleh IT Officer.' using errcode='42501';end if;
 if length(trim(coalesce(new.archive_reason,''))) not between 8 and 2000 then raise exception 'Alasan pengelolaan direktori wajib diisi (8–2000 karakter).';end if;
 if new.merged_into_employee_id is not null then raise exception 'Kelola identitas utama, bukan alias historis.';end if;
 if exists(select 1 from public.profiles p where p.id=auth.uid() and p.employee_id=new.id) then raise exception 'Identitas sendiri tidak dapat diarsipkan.' using errcode='42501';end if;
 if new.archived_at is not null then
  if old.archived_at is not null then raise exception 'Identitas sudah berada di arsip.';end if;
  if exists(select 1 from public.profiles p where p.employee_id=new.id and p.is_active and p.retired_at is null) then raise exception 'Identitas masih memiliki akun login aktif. Nonaktifkan/kelola akun terlebih dahulu.';end if;
  new.archived_at:=now();new.archived_by:=auth.uid();
 else
  if old.archived_at is null then raise exception 'Identitas belum berada di arsip.';end if;
  new.archived_by:=null;
 end if;
 new.archive_reason:=trim(new.archive_reason);
 return new;
end $$;
revoke all on function private.guard_employee_directory_archive() from public,anon,authenticated;
create trigger employee_archive_guard before insert or update on public.employee_directory for each row execute function private.guard_employee_directory_archive();
create or replace view public.employee_directory_records with(security_invoker=true) as
 select e.* from public.employee_directory e where merged_into_employee_id is null and archived_at is null;

create function public.manage_employee_directory(employee uuid,b text,operation text,reason text,expected_updated_at timestamptz)
 returns uuid language plpgsql security invoker set search_path='' as $$
declare e public.employee_directory;
begin
 if auth.uid() is null or not private.has_role(b,array['super_admin']) then raise exception 'Pengelolaan direktori hanya oleh IT Officer pada cabang ini.' using errcode='42501';end if;
 if length(trim(coalesce(reason,''))) not between 8 and 2000 then raise exception 'Keterangan minimal 8 karakter.';end if;
 select * into e from public.employee_directory where id=employee and branch_code=b for update;
 if e.id is null or e.merged_into_employee_id is not null then raise exception 'Identitas utama tidak ditemukan.';end if;
 if e.updated_at is distinct from expected_updated_at then raise exception 'Data telah berubah. Muat ulang sebelum melanjutkan.';end if;
 if operation='archive' then
  update public.employee_directory set archived_at=now(),archive_reason=reason where id=e.id and branch_code=b;
 elsif operation='restore' then
  update public.employee_directory set archived_at=null,archived_by=null,archive_reason=reason where id=e.id and branch_code=b;
 elsif operation='verify' then
  if e.archived_at is not null then raise exception 'Pulihkan identitas sebelum verifikasi nama.';end if;
  if e.verification_status='verified' then raise exception 'Nama sudah terverifikasi.';end if;
  update public.employee_directory set verification_status='verified',verification_note=reason where id=e.id and branch_code=b;
 else raise exception 'Tindakan tidak tersedia.';
 end if;
 return e.id;
end $$;
revoke all on function public.manage_employee_directory(uuid,text,text,text,timestamptz) from public,anon;
grant execute on function public.manage_employee_directory(uuid,text,text,text,timestamptz) to authenticated;
