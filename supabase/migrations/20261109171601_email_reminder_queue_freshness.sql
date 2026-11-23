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
    concat_ws(E'\n','Pengingat VALIDA Cabang '||s.branch_code,'Data pemantauan per '||today::text||' WITA','Nama / alat: '||s.entity_name,'Lisensi / layanan: '||coalesce(s.title,'—'),'Nomor sertifikat: '||coalesce(s.certificate_number,'—'),'Portofolio: '||coalesce((select po.code from public.portfolios po where po.id=s.portfolio_id and po.branch_code=s.branch_code),'Belum dipetakan'),'Tanggal berakhir: '||s.expiry_date::text,
    case when d<0 then 'Sudah lewat '||abs(d)||' hari.' else 'Sisa '||d||' hari.' end,'Mohon periksa dokumen dan tindak lanjut melalui VALIDA. Status proses tidak memperpanjang masa berlaku.'),s.revision,k)
   on conflict(dedupe_key) do nothing;
   get diagnostics changed=row_count;n:=n+changed;if n>=100 then return n;end if;
  end loop;
 end loop;return n;
end $$;
create or replace function public.claim_email_deliveries(batch_size integer,delivery_mode text,only_job uuid default null) returns setof public.email_outbox
language plpgsql security definer set search_path='' as $$
begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'Worker only.' using errcode='42501';end if;
 update public.email_outbox set state='uncertain',result_code='WORKER_INTERRUPTED',updated_at=now() where state='sending' and claimed_at<now()-interval '15 minutes';
 update public.email_outbox o set state='cancelled',result_code='SOURCE_CHANGED',updated_at=now()
  where state='pending' and mode=delivery_mode and (only_job is null or o.id=only_job) and not exists(
   select 1 from private.email_reminder_sources s where s.domain=o.domain and s.id=o.record_id and s.branch_code=o.branch_code and s.revision=o.source_revision);
 update public.email_outbox o set state='cancelled',result_code='RECIPIENT_CHANGED',updated_at=now()
 where state='pending' and mode='live' and (
  (kind='renewal' and not exists(select 1 from public.client_contacts c where c.id=o.contact_id and c.branch_code=o.branch_code and c.is_active and c.is_primary and not c.is_test and c.verification_status='verified' and lower(trim(c.email))=o.recipient))
  or (kind='reminder' and not private.email_recipient_current(o.branch_code,o.domain,o.record_id,o.recipient_profile_id,o.recipient)));
 update public.email_outbox o set state='cancelled',result_code='ACTOR_REVOKED',updated_at=now()
 where state='pending' and kind='renewal' and not exists(select 1 from public.profiles p join public.user_role_assignments g on g.profile_id=p.id and g.branch_code=o.branch_code join public.roles r on r.code=g.role_code and r.is_active
 where p.id=o.created_by and p.is_active and p.retired_at is null and g.is_active and g.revoked_at is null and g.role_code in ('super_admin','admin','account_manager'));
 update public.email_outbox o set state='cancelled',result_code='REMINDER_WINDOW_CHANGED',updated_at=now()
 where state='pending' and kind='reminder' and mode=delivery_mode and (only_job is null or o.id=only_job)
 and not exists(select 1 from public.email_reminder_settings settings join private.email_reminder_sources source on source.branch_code=settings.branch_code
 where settings.enabled and source.branch_code=o.branch_code and source.domain=o.domain and source.id=o.record_id
 and (select min(day) from unnest(settings.days) day where source.expiry_date-(now() at time zone 'Asia/Makassar')::date<=day)=split_part(o.dedupe_key,':',6)::integer);
 return query update public.email_outbox o set state='sending',claim_token=gen_random_uuid(),claimed_at=now(),attempt_count=attempt_count+1,updated_at=now()
 from (select id from public.email_outbox where state='pending' and mode=delivery_mode and next_attempt_at<=now() and (only_job is null or id=only_job)
  order by created_at for update skip locked limit greatest(1,least(batch_size,20))) selected where o.id=selected.id returning o.*;
end $$;
