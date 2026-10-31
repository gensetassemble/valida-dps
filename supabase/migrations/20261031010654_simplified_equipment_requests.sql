-- Simplified request tracking; exported Excel is completed manually outside VALIDA.
alter table public.calibration_requests add column request_kind text not null default 'calibration' check(request_kind in ('calibration','repair'));
create or replace function private.calibration_request_scope(b text,e uuid,mode text default 'read') returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
 (mode='read' and private.equipment_scope(b,e,false)) or
 (mode='ptk' and private.target_has_role(auth.uid(),b,'equipment_manager') and private.equipment_scope(b,e,true)) or
 (mode='requester' and private.target_has_role(auth.uid(),b,'coordinator') and exists(select 1 from public.equipment x where x.id=e and x.branch_code=b and x.ownership='internal' and private.portfolio_scope(b,x.portfolio_id))));
$$;
create or replace function private.guard_calibration_request() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.equipment; holder public.employee_directory; supervisor text;
begin
 if auth.uid() is null then raise exception 'Akun aktif diperlukan.' using errcode='42501';end if;
 if tg_op='INSERT' then
  if new.status<>'submitted' or not private.calibration_request_scope(new.branch_code,new.equipment_id,'requester') then raise exception 'Pengajuan hanya oleh Koordinator Operasional sesuai portofolio.' using errcode='42501';end if;
  if new.estimated_days is not null or new.estimated_cost is not null or new.requester_signed or new.supervisor_signed or new.signed_document_id is not null or new.calibration_id is not null then raise exception 'Biaya, hari kerja dan administrasi lanjutan diisi manual di Excel.';end if;
  if length(trim(coalesce(new.request_number,'')))<2 or length(trim(coalesce(new.unit_name,'')))<2 or length(trim(new.notes))<8 then raise exception 'Lengkapi nomor permintaan, unit kerja dan keterangan minimal 8 karakter.';end if;
  select * into e from public.equipment where id=new.equipment_id and branch_code=new.branch_code and ownership='internal';
  if e.id is null then raise exception 'Alat internal tidak ditemukan.';end if;
  new.equipment_snapshot:=jsonb_build_object('name',e.name,'tag',e.tag,'asset_id',e.asset_id,'serial',e.serial,'brand',e.brand,'model',e.model,'location',e.location,'measurement_range',e.measurement_range,'specification_size',e.specification_size,'portfolio_id',e.portfolio_id);
  select d.* into holder from public.profiles p join public.employee_directory d on d.id=p.employee_id and d.branch_code=new.branch_code where p.id=auth.uid() and d.archived_at is null and d.merged_into_employee_id is null;
  new.requester_employee_id:=holder.id;new.requester_npp:=holder.npp;
  new.requester_name:=coalesce(holder.full_name,(select full_name from public.profiles where id=auth.uid()));
  new.supervisor_name:=null;
  if new.supervisor_profile_id is not null then
   select coalesce(d.full_name,p.full_name) into supervisor from public.profiles p left join public.employee_directory d on d.id=p.employee_id and d.branch_code=new.branch_code where p.id=new.supervisor_profile_id and (private.target_has_role(p.id,new.branch_code,'department_head') or private.target_has_role(p.id,new.branch_code,'unit_head'));
   if supervisor is null then raise exception 'Pejabat tidak aktif pada cabang ini.';end if;
   new.supervisor_name:=supervisor;
  end if;
  new.created_by:=auth.uid();new.created_at:=now();new.version:=1;
 else
  if not private.calibration_request_scope(old.branch_code,old.equipment_id,'ptk') then raise exception 'Progres hanya dapat diperbarui PTK.' using errcode='42501';end if;
  if old.status in ('completed','cancelled') then raise exception 'Pengajuan sudah ditutup.';end if;
  if new.status not in ('accepted','completed') or new.status=old.status then raise exception 'Pilih Mulai Proses atau Selesai.';end if;
  if (to_jsonb(new)-array['status','version','updated_at','updated_by']) is distinct from (to_jsonb(old)-array['status','version','updated_at','updated_by']) then raise exception 'Isian pengajuan tetap; administrasi lanjutan dilakukan manual di Excel.' using errcode='42501';end if;
  new.version:=old.version+1;
 end if;
 new.updated_by:=auth.uid();new.updated_at:=now();return new;
end $$;
revoke all on function private.guard_calibration_request() from public,anon,authenticated;
create function private.record_simple_calibration_event() returns trigger language plpgsql security definer set search_path='' as $$
declare event uuid:=gen_random_uuid();portfolio uuid;title text;link text;
begin
 if tg_op='UPDATE' and new.status=old.status then return new;end if;
 insert into public.calibration_request_events(id,request_id,branch_code,previous_status,new_status,notes,actor_id) values(event,new.id,new.branch_code,case when tg_op='UPDATE' then old.status end,new.status,new.notes,auth.uid());
 select portfolio_id into portfolio from public.equipment where id=new.equipment_id and branch_code=new.branch_code;
 title:='Permintaan alat: '||case new.status when 'submitted' then 'Sedang Diajukan' when 'accepted' then 'Sedang Diproses' when 'completed' then 'Selesai' else new.status end;
 link:='/kalibrasi-alat/'||new.equipment_id::text||'?branch='||new.branch_code;
 insert into public.user_notifications(branch_code,profile_id,event_id,title,href)
 select distinct new.branch_code,p.id,event,title,link from public.profiles p where p.is_active and p.retired_at is null and (
 (p.id=new.created_by and private.target_has_role(p.id,new.branch_code,'coordinator')) or
 (new.status='submitted' and private.target_has_role(p.id,new.branch_code,'equipment_manager') and exists(select 1 from public.employee_portfolio_assignments a where a.employee_id=p.employee_id and a.branch_code=new.branch_code and a.portfolio_id=portfolio and a.assignment_type='equipment_responsible' and a.is_active and a.verification_status='verified' and a.approved_at is not null and a.effective_from<=(now() at time zone 'Asia/Makassar')::date and (a.effective_until is null or a.effective_until>=(now() at time zone 'Asia/Makassar')::date)))) on conflict do nothing;
 return new;
end $$;
revoke all on function private.record_simple_calibration_event() from public,anon,authenticated;
drop trigger workflow_event on public.calibration_requests;
create trigger workflow_event after insert or update on public.calibration_requests for each row execute function private.record_simple_calibration_event();
