CREATE OR REPLACE FUNCTION private.record_operational_workflow_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare event uuid:=gen_random_uuid();holder uuid;available boolean;link text;title text;portfolio uuid;
begin
 if tg_op='UPDATE' and new.status=old.status then return new;end if;
 if tg_table_name='calibration_requests' then
  insert into public.calibration_request_events(id,request_id,branch_code,previous_status,new_status,notes,actor_id) values(event,new.id,new.branch_code,case when tg_op='UPDATE' then old.status end,new.status,new.notes,auth.uid());
  link:='/kalibrasi-alat/'||new.equipment_id::text||'?branch='||new.branch_code;
  title:='Permintaan kalibrasi: '||case new.status when 'submitted' then 'Diajukan ke PTK' when 'correction' then 'Perlu Perbaikan Dokumen' when 'accepted' then 'Diterima PTK' when 'completed' then 'Selesai' when 'cancelled' then 'Dibatalkan' when 'awaiting_signatures' then 'Menunggu Tanda Tangan' else 'Draf' end;
  select portfolio_id into portfolio from public.equipment where id=new.equipment_id;
  insert into public.user_notifications(branch_code,profile_id,event_id,title,href)
  select distinct new.branch_code,p.id,event,title,link from public.profiles p where p.is_active and (p.id=new.created_by or (new.status='submitted' and exists(select 1 from public.user_role_assignments g where g.profile_id=p.id and g.branch_code=new.branch_code and g.is_active and g.revoked_at is null and (g.role_code in ('admin','super_admin') or (g.role_code='equipment_manager' and exists(select 1 from public.employee_portfolio_assignments a where a.employee_id=p.employee_id and a.portfolio_id=portfolio and a.assignment_type='equipment_responsible' and a.is_active and a.verification_status='verified' and a.approved_at is not null and a.effective_from<=current_date and (a.effective_until is null or a.effective_until>=current_date))))))) on conflict do nothing;
 else
  select employee_id into holder from public.personnel_certificates where id=new.certificate_id;
  select exists(select 1 from public.profiles p where p.employee_id=holder and p.is_active and p.branch_code=new.branch_code and exists(select 1 from public.user_role_assignments g join public.roles ro on ro.code=g.role_code and ro.is_active where g.profile_id=p.id and g.branch_code=new.branch_code and g.is_active and g.revoked_at is null and (g.role_code in ('inspector','hrga','admin','super_admin','branch_head','department_head','unit_head','tester') or (g.role_code in ('coordinator','qshe') and exists(select 1 from public.employee_portfolio_assignments a where a.employee_id=p.employee_id and a.branch_code=new.branch_code and a.assignment_type=g.role_code and a.is_active and a.verification_status='verified' and a.approved_at is not null and a.effective_from<=(now() at time zone 'Asia/Makassar')::date and (a.effective_until is null or a.effective_until>=(now() at time zone 'Asia/Makassar')::date)))))) into available;
  insert into public.personnel_renewal_events(id,case_id,branch_code,previous_status,new_status,notes,actor_id,holder_delivery_available) values(event,new.id,new.branch_code,case when tg_op='UPDATE' then old.status end,new.status,new.notes,auth.uid(),available);
  link:='/kompetensi-personil/'||new.certificate_id::text||'?branch='||new.branch_code;
  title:='Status perpanjangan sertifikat: '||case new.status when 'processing' then 'Sedang Diproses' when 'renewed' then 'Sudah Diperpanjang' else 'Belum Diproses' end;
  insert into public.user_notifications(branch_code,profile_id,event_id,title,href)
  select distinct new.branch_code,p.id,event,title,link from public.profiles p where p.is_active and p.branch_code=new.branch_code and exists(select 1 from public.user_role_assignments g join public.roles ro on ro.code=g.role_code and ro.is_active where g.profile_id=p.id and g.branch_code=new.branch_code and g.is_active and g.revoked_at is null and (g.role_code in ('hrga','admin','super_admin') or (p.employee_id=holder and g.role_code in ('inspector','branch_head','department_head','unit_head','tester')) or (g.role_code in ('coordinator','qshe') and exists(select 1 from public.employee_portfolio_assignments recipient join public.employee_portfolio_assignments subject on subject.portfolio_id=recipient.portfolio_id and subject.branch_code=recipient.branch_code where recipient.employee_id=p.employee_id and recipient.branch_code=new.branch_code and recipient.assignment_type=g.role_code and recipient.is_active and recipient.verification_status='verified' and recipient.approved_at is not null and recipient.effective_from<=(now() at time zone 'Asia/Makassar')::date and (recipient.effective_until is null or recipient.effective_until>=(now() at time zone 'Asia/Makassar')::date) and subject.employee_id=holder and subject.is_active and subject.verification_status='verified' and subject.effective_from<=(now() at time zone 'Asia/Makassar')::date and (subject.effective_until is null or subject.effective_until>=(now() at time zone 'Asia/Makassar')::date))))) on conflict do nothing;
 end if;
 return new;
end $function$;
