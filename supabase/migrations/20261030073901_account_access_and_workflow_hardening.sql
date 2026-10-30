-- Account access follows explicit account/role grants, without employee activation.
alter table public.profiles add column retired_at timestamptz,add column retirement_reason text;
create or replace function private.actor_enabled() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.retired_at is null);
$$;
create or replace function private.target_has_role(u uuid,b text,r text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.user_role_assignments a on a.profile_id=p.id and a.is_active and a.revoked_at is null join public.roles ro on ro.code=a.role_code and ro.is_active join public.branches br on br.code=a.branch_code and br.is_active where p.id=u and p.is_active and p.retired_at is null and a.branch_code=b and a.role_code=r);
$$;
CREATE OR REPLACE FUNCTION private.guard_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j jsonb:=to_jsonb(new); oldj jsonb; actor uuid:=auth.uid(); old_branch text; expected_category text; target_client uuid;
begin
 if tg_op='UPDATE' then
  oldj:=to_jsonb(old); old_branch:=coalesce(oldj->>'branch_code',oldj->>'code');
  if j->>'id' is distinct from oldj->>'id' or coalesce(j->>'branch_code',j->>'code') is distinct from old_branch then
   raise exception 'Identitas dan cabang rekaman tidak dapat diubah.' using errcode='42501';
  end if;
  new.created_at:=old.created_at; new.created_by:=old.created_by;
 else new.created_at:=now(); new.created_by:=actor; end if;
 new.updated_at:=now(); new.updated_by:=actor;
 if tg_table_name='profiles' then
  if tg_op='UPDATE' and new.role_code is distinct from old.role_code then raise exception 'role_code lama tidak dapat dipakai untuk memberi kewenangan.' using errcode='42501'; end if;
  if new.employee_id is not null and not exists(select 1 from public.employee_directory e where e.id=new.employee_id and e.branch_code=new.branch_code) then raise exception 'Identitas pegawai berbeda cabang.';end if;
  if new.retired_at is not null and new.is_active then raise exception 'Akun yang diarsipkan tidak boleh aktif.';end if;
  -- Login is controlled by the account and reviewed role grants, not employee verification.
  if new.is_active and (tg_op='INSERT' or not old.is_active) then new.activated_at:=now();new.activated_by:=actor;end if;
 end if;
 if tg_table_name='user_role_assignments' then
  if actor is not null and new.profile_id=actor then raise exception 'Penugasan peran sendiri tidak diizinkan.' using errcode='42501'; end if;
  if tg_op='UPDATE' and (new.profile_id<>old.profile_id or new.role_code<>old.role_code) then raise exception 'Identitas penugasan tidak dapat diubah.' using errcode='42501'; end if;
  if not exists(select 1 from public.roles where code=new.role_code and is_active) then raise exception 'Peran tidak aktif.' using errcode='23514'; end if;
  if tg_op='INSERT' or (new.is_active and not old.is_active) then new.granted_at:=now(); new.granted_by:=actor; end if;
  if new.is_active then new.revoked_at:=null; new.revoked_by:=null; else new.revoked_at:=now(); new.revoked_by:=actor; end if;
 end if;
 if j ? 'verification_status' then
  if tg_op='INSERT' or j->>'verification_status' is distinct from oldj->>'verification_status' then
   if tg_table_name='employee_portfolio_assignments' then
    if new.verification_status='verified' then new.approved_at:=now(); new.approved_by:=actor; else new.approved_at:=null; new.approved_by:=null; end if;
   else
    if new.verification_status='verified' then new.verified_at:=now(); new.verified_by:=actor; else new.verified_at:=null; new.verified_by:=null; end if;
   end if;
  elsif tg_table_name='employee_portfolio_assignments' then new.approved_at:=old.approved_at; new.approved_by:=old.approved_by;
  else new.verified_at:=old.verified_at; new.verified_by:=old.verified_by; end if;
 end if;
 if tg_table_name='clients' then
  if tg_op='UPDATE' and new.account_manager_id is distinct from old.account_manager_id then
   if actor is not null and not private.has_role(new.branch_code,array['admin']) then raise exception 'Pengalihan AM memerlukan administrator cabang.' using errcode='42501'; end if;
   if length(trim(coalesce(new.assignment_reason,'')))<8 then raise exception 'Alasan pengalihan AM minimal 8 karakter.' using errcode='23514'; end if;
  end if;
  if new.account_manager_id is not null and not private.target_has_role(new.account_manager_id,new.branch_code,'account_manager') then raise exception 'AM harus memiliki penugasan aktif pada cabang pelanggan.' using errcode='23514'; end if;
 end if;
 if tg_table_name in ('client_certificates','personnel_certificates','service_competency_requirements') then
  expected_category:=case when tg_table_name='client_certificates' then 'client' else 'personnel' end;
  if not exists(select 1 from public.certificate_types c where c.id=new.certificate_type_id and c.branch_code=new.branch_code and c.category=expected_category) then raise exception 'Kategori jenis sertifikat tidak sesuai.' using errcode='23514'; end if;
 end if;
 if tg_op='UPDATE' and actor is not null and tg_table_name in ('client_contacts','client_certificates','personnel_certificates','calibrations','employee_portfolio_assignments','portfolio_aliases','service_competency_requirements','personnel_certificate_services') then
  if (j->>'client_id' is distinct from oldj->>'client_id') or (j->>'employee_id' is distinct from oldj->>'employee_id') or (j->>'equipment_id' is distinct from oldj->>'equipment_id') or (j->>'personnel_certificate_id' is distinct from oldj->>'personnel_certificate_id') or (j->>'portfolio_id' is distinct from oldj->>'portfolio_id') or (j->>'service_type_id' is distinct from oldj->>'service_type_id') then
   raise exception 'Relasi induk tidak dapat dipindahkan melalui perubahan rekaman.' using errcode='42501';
  end if;
 end if;
 if tg_table_name='equipment' then
  if tg_op='UPDATE' and actor is not null and not private.has_role(new.branch_code,array['admin']) then
   if new.portfolio_id is distinct from old.portfolio_id or new.client_id is distinct from old.client_id or new.responsible_employee_id is distinct from old.responsible_employee_id then raise exception 'Pengalihan kepemilikan aset memerlukan administrator.' using errcode='42501'; end if;
  end if;
 end if;
 return new;
end $function$;

create or replace view public.profile_identity_records with(security_invoker=true) as
select p.id,p.branch_code,p.role_code,p.display_name,p.is_active,p.activated_at,p.activated_by,p.created_at,p.employee_id,p.full_name,p.email,p.whatsapp,p.updated_at,p.created_by,p.updated_by,e.npp,p.retired_at,p.retirement_reason
from public.profiles p left join public.employee_directory e on e.id=p.employee_id and e.branch_code=p.branch_code where p.retired_at is null;
revoke all on function private.actor_enabled() from public,anon;
grant execute on function private.actor_enabled() to authenticated;
revoke all on function private.target_has_role(uuid,text,text),private.guard_record() from public,anon,authenticated;
-- Preserve one stable actor timestamp for inbox changes.
create function private.notification_read_timestamp() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=now();return new;end $$;
revoke all on function private.notification_read_timestamp() from public,anon,authenticated;
create trigger notification_read_timestamp before update on public.user_notifications for each row execute function private.notification_read_timestamp();
create policy workflow_documents_restrictive on storage.objects as restrictive for all to anon,authenticated
using(bucket_id<>'workflow-documents' or exists(select 1 from public.workflow_documents d where d.object_path=name))
with check(bucket_id<>'workflow-documents' or exists(select 1 from public.workflow_documents d join public.calibration_requests r on r.id=d.request_id where d.object_path=name and r.status in ('draft','awaiting_signatures','correction') and private.calibration_request_scope(r.branch_code,r.equipment_id,'requester')));
-- Cover workflow foreign keys, including audit actors; avoid redundant indexes.
do $$declare fk record;cols text;begin
 for fk in select con.* from pg_constraint con where con.contype='f' and con.conrelid in ('public.calibration_requests'::regclass,'public.calibration_request_events'::regclass,'public.personnel_renewal_cases'::regclass,'public.personnel_renewal_events'::regclass,'public.workflow_documents'::regclass,'public.portfolio_coordinators'::regclass,'public.user_notifications'::regclass,'public.operational_coordinators'::regclass) loop
  if not exists(select 1 from pg_index i where i.indrelid=fk.conrelid and i.indisvalid and i.indpred is null and (i.indkey::smallint[])[0:cardinality(fk.conkey)-1] @> fk.conkey) then
   select string_agg(quote_ident(a.attname),',' order by k.n) into cols from unnest(fk.conkey) with ordinality k(attnum,n) join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=k.attnum;
   execute format('create index %I on %s (%s)','wf_fk_'||substr(md5(fk.conname||fk.conrelid::text),1,20),fk.conrelid::regclass,cols);
  end if;
 end loop;
end $$;
