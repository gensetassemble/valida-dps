create or replace view private.email_reminder_sources with(security_invoker=true) as
select 'clients'::text domain,c.branch_code,c.id,c.client_name entity_name,c.certificate_type_name title,c.certificate_number,
 c.expiry_date,c.scope_portfolio_id portfolio_id,null::uuid employee_id,c.account_manager_id,
 md5(concat_ws('|',c.id,c.expiry_date,c.certificate_number,c.client_id,c.client_name,c.certificate_type_name,c.object_type,c.object_serial,c.installation_location,c.scope_portfolio_id)) revision
from public.client_certificate_display_records c join public.clients cl on cl.id=c.client_id and cl.branch_code=c.branch_code
where c.is_active and not c.is_example and cl.is_active and not cl.is_example and c.superseded_by_certificate_id is null
union all
select 'personnel',c.branch_code,c.id,c.employee_name,c.original_title,c.certificate_number,c.expiry_date,c.portfolio_id,c.employee_id,null::uuid,
 md5(concat_ws('|',c.id,c.expiry_date,c.certificate_number,c.portfolio_id,c.original_title,c.employee_name))
from public.personnel_certificate_portfolios c join public.employee_directory e on e.id=c.employee_id and e.branch_code=c.branch_code
where c.is_active and c.superseded_by_certificate_id is null and c.validity_kind<>'lifetime' and e.employment_status<>'inactive' and e.archived_at is null and e.full_name not like '[CONTOH]%'
union all
select 'calibrations',e.branch_code,e.id,concat_ws(' · ',e.name,e.tag,e.owner_unit),'Kalibrasi alat',e.monitoring_certificate,e.latest_due_date,e.portfolio_id,null::uuid,null::uuid,
 md5(concat_ws('|',e.id,e.latest_calibration_id,e.latest_due_date,e.monitoring_certificate,e.portfolio_id,e.name,e.tag,e.owner_unit))
from public.equipment_monitoring_records e where e.is_active and e.ownership='internal' and e.name not like '[CONTOH]%';

create or replace function public.configure_email_reminders(b text,active boolean,thresholds integer[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(b,array['super_admin']) then raise exception 'Hanya Super Admin mengelola reminder.' using errcode='42501'; end if;
 if cardinality(thresholds) not between 1 and 8 or array_position(thresholds,null) is not null or not (-365<=all(thresholds) and 365>=all(thresholds)) then raise exception 'Ambang hari tidak valid.'; end if;
 insert into public.email_reminder_settings(branch_code,enabled,days,updated_by) values(b,active,thresholds,auth.uid())
 on conflict(branch_code) do update set enabled=excluded.enabled,days=excluded.days,updated_by=auth.uid(),updated_at=now();
 if not active then update public.email_outbox set state='cancelled',result_code='REMINDERS_PAUSED',updated_at=now() where branch_code=b and kind='reminder' and state='pending';end if;
end $$;
create or replace function public.enqueue_client_renewal_email(b text,certificate uuid,pic uuid,delivery_mode text,email_subject text,email_body text) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.client_certificate_display_records; r public.client_contacts; target text; k text; job uuid; rev text;
begin
 if not private.has_role(b,array['admin','account_manager']) then raise exception 'Akses email ditolak.' using errcode='42501';end if;
 select * into c from public.client_certificate_display_records where id=certificate and branch_code=b and is_active and not is_example and superseded_by_certificate_id is null;
 if c.id is null or not private.client_scope(b,c.client_id,true) then raise exception 'Sertifikat tidak tersedia.' using errcode='42501';end if;
 if delivery_mode='test' then
  if not private.has_role(b,array['admin']) then raise exception 'Uji email hanya oleh Admin.' using errcode='42501';end if;
  target:='adli.alfian@sucofindo.co.id';
 elsif delivery_mode='live' then
  select * into r from public.client_contacts where id=pic and client_id=c.client_id and branch_code=b and is_active and is_primary and not is_test and verification_status='verified';
  if r.id is null or r.email is null then raise exception 'PIC utama resmi terverifikasi diperlukan.';end if;
  target:=lower(trim(r.email));
 else raise exception 'Mode pengiriman tidak valid.';end if;
 select revision into rev from private.email_reminder_sources where domain='clients' and id=c.id and branch_code=b;
 if rev is null then raise exception 'Sertifikat sudah berubah atau tidak aktif.';end if;
 k:=concat_ws(':','renewal',b,c.id,delivery_mode,rev,md5(concat_ws('|',target,email_subject,email_body)));
 insert into public.email_outbox(branch_code,kind,mode,domain,record_id,recipient,contact_id,subject,body,source_revision,dedupe_key,created_by)
 values(b,'renewal',delivery_mode,'clients',c.id,target,case when delivery_mode='live' then r.id end,email_subject,email_body,rev,k,auth.uid())
 on conflict(dedupe_key) do nothing returning id into job;
 if job is null then select id into job from public.email_outbox where dedupe_key=k;end if;
 return job;
end $$;
create or replace function public.enqueue_due_email_reminders(delivery_mode text) returns integer
language plpgsql security definer set search_path='' as $$
declare s record; p record; t integer; d integer; n integer:=0; changed integer; target text; k text; today date:=(now() at time zone 'Asia/Makassar')::date;
begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' or delivery_mode not in ('test','live') then raise exception 'Worker only.' using errcode='42501';end if;
 for s in select source.*,settings.days from private.email_reminder_sources source join public.email_reminder_settings settings using(branch_code)
  where settings.enabled and source.expiry_date<=today+365 order by source.expiry_date,source.id loop
  d:=s.expiry_date-today; select min(x) into t from unnest(s.days) x where d<=x;
  if t is null then continue;end if;
  for p in select distinct profile.id,profile.email from public.profiles profile join public.employee_directory employee on employee.id=profile.employee_id and employee.branch_code=profile.branch_code
   join auth.users mailbox on mailbox.id=profile.id and lower(mailbox.email)=lower(profile.email) and mailbox.email_confirmed_at is not null
   where profile.branch_code=s.branch_code and profile.is_active and profile.retired_at is null and employee.archived_at is null and employee.employment_status<>'inactive'
   and profile.email ~* '^[^[:space:]@]+@sucofindo[.]co[.]id$'
   and exists(select 1 from public.user_role_assignments g join public.roles ro on ro.code=g.role_code and ro.is_active
    where g.profile_id=profile.id and g.branch_code=s.branch_code and g.is_active and g.revoked_at is null and (
     (s.domain='clients' and g.role_code='account_manager' and profile.id=s.account_manager_id)
     or (s.domain='personnel' and (g.role_code='hrga' or profile.employee_id=s.employee_id))
     or (s.domain='calibrations' and g.role_code='equipment_manager')
     or (s.domain in ('personnel','calibrations') and g.role_code='coordinator' and exists(
      select 1 from public.employee_portfolio_assignments a where a.employee_id=profile.employee_id and a.branch_code=s.branch_code and a.portfolio_id=s.portfolio_id and a.assignment_type='coordinator' and a.is_active and a.verification_status='verified' and a.approved_at is not null and a.effective_from<=today and (a.effective_until is null or a.effective_until>=today))))) loop
   target:=case when delivery_mode='test' then 'adli.alfian@sucofindo.co.id' else lower(trim(p.email)) end;
   k:=concat_ws(':','reminder',s.branch_code,s.domain,s.id,s.expiry_date,t,s.revision,delivery_mode,case when delivery_mode='test' then 'test-recipient' else p.id::text end);
   insert into public.email_outbox(branch_code,kind,mode,domain,record_id,recipient,recipient_profile_id,subject,body,source_revision,dedupe_key)
   values(s.branch_code,'reminder',delivery_mode,s.domain,s.id,target,case when delivery_mode='live' then p.id end,
    case when delivery_mode='test' then '[UJI INTERNAL] ' else '' end||'Pengingat masa berlaku — '||coalesce(s.entity_name,'Rekaman'),
    case when delivery_mode='test' then '[UJI INTERNAL — BUKAN PEMBERITAHUAN RESMI]'||E'\n\n' else '' end||
    concat_ws(E'\n','Pengingat VALIDA Cabang '||s.branch_code,'Nama / alat: '||s.entity_name,'Lisensi / layanan: '||coalesce(s.title,'—'),'Nomor sertifikat: '||coalesce(s.certificate_number,'—'),'Portofolio: '||coalesce((select po.code from public.portfolios po where po.id=s.portfolio_id and po.branch_code=s.branch_code),'Belum dipetakan'),'Tanggal berakhir: '||s.expiry_date::text,
    case when d<0 then 'Sudah lewat '||abs(d)||' hari.' else 'Sisa '||d||' hari.' end,'Mohon periksa dokumen dan tindak lanjut melalui VALIDA. Status proses tidak memperpanjang masa berlaku.'),s.revision,k)
   on conflict(dedupe_key) do nothing;
   get diagnostics changed=row_count;n:=n+changed;if n>=100 then return n;end if;
  end loop;
 end loop;return n;
end $$;
