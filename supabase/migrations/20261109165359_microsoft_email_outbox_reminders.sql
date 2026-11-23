-- No delivery is enabled by this migration. Sender credentials and switches stay server-only.
create table public.email_outbox (
 id uuid primary key default gen_random_uuid(), branch_code text not null references public.branches(code),
 kind text not null check(kind in ('renewal','reminder')), mode text not null check(mode in ('test','live')),
 domain text not null check(domain in ('clients','personnel','calibrations')), record_id uuid not null,
 recipient text not null check(length(recipient)<=254 and recipient ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
 recipient_profile_id uuid references public.profiles(id), contact_id uuid references public.client_contacts(id),
 subject text not null check(length(subject) between 3 and 500 and subject !~ E'[\r\n]'),
 body text not null check(length(body) between 20 and 16000),
 source_revision text not null, dedupe_key text not null unique,
 state text not null default 'pending' check(state in ('pending','sending','accepted','failed','uncertain','cancelled')),
 attempt_count integer not null default 0, next_attempt_at timestamptz not null default now(),
 claim_token uuid, claimed_at timestamptz, provider_request_id text, result_code text,
 created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
create index email_outbox_pending on public.email_outbox(next_attempt_at,created_at) where state='pending';
create index email_outbox_branch on public.email_outbox(branch_code,created_at desc);
create table public.email_delivery_events (
 id bigint generated always as identity primary key, outbox_id uuid not null references public.email_outbox(id),
 state text not null, code text, actor_id uuid, occurred_at timestamptz not null default now()
);
create table public.email_reminder_settings (
 id uuid not null unique default gen_random_uuid(),
 branch_code text primary key references public.branches(code), enabled boolean not null default false,
 days integer[] not null default array[90,60,30,7,0,-7,-30],
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
 check(cardinality(days) between 1 and 8 and -365<=all(days) and 365>=all(days) and array_position(days,null) is null)
);
alter table public.email_outbox enable row level security;
alter table public.email_delivery_events enable row level security;
alter table public.email_reminder_settings enable row level security;
revoke all on public.email_outbox,public.email_delivery_events,public.email_reminder_settings from public,anon,authenticated;
grant select on public.email_outbox,public.email_delivery_events,public.email_reminder_settings to authenticated;
grant all on public.email_outbox,public.email_delivery_events,public.email_reminder_settings to service_role;
grant usage,select on sequence public.email_delivery_events_id_seq to service_role;
create policy email_outbox_read on public.email_outbox for select to authenticated using(
 private.has_role(branch_code,array['admin']) or
 (created_by=(select auth.uid()) and private.has_role(branch_code,array['account_manager']))
);
create policy email_event_read on public.email_delivery_events for select to authenticated using(exists(select 1 from public.email_outbox o where o.id=outbox_id));
create policy email_settings_read on public.email_reminder_settings for select to authenticated using(private.has_role(branch_code,array['admin']));

create view private.email_reminder_sources with(security_invoker=true) as
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
revoke all on private.email_reminder_sources from public,anon,authenticated;
grant select on private.email_reminder_sources to service_role;

create function private.audit_email_delivery() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or new.state is distinct from old.state then
  insert into public.email_delivery_events(outbox_id,state,code,actor_id) values(new.id,new.state,new.result_code,auth.uid());
 end if;
 return new;
end $$;
revoke all on function private.audit_email_delivery() from public,anon,authenticated;
create trigger audit_email_delivery after insert or update on public.email_outbox for each row execute function private.audit_email_delivery();

create function public.configure_email_reminders(b text,active boolean,thresholds integer[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(b,array['super_admin']) then raise exception 'Hanya Super Admin mengelola reminder.' using errcode='42501'; end if;
 if cardinality(thresholds) not between 1 and 8 or array_position(thresholds,null) is not null or not (-365<=all(thresholds) and 365>=all(thresholds)) then raise exception 'Ambang hari tidak valid.'; end if;
 insert into public.email_reminder_settings(branch_code,enabled,days,updated_by) values(b,active,thresholds,auth.uid())
 on conflict(branch_code) do update set enabled=excluded.enabled,days=excluded.days,updated_by=auth.uid(),updated_at=now();
end $$;
revoke all on function public.configure_email_reminders(text,boolean,integer[]) from public,anon;
grant execute on function public.configure_email_reminders(text,boolean,integer[]) to authenticated;
create trigger audit_email_reminder_settings after insert or update on public.email_reminder_settings for each row execute function private.audit_business_record();

create function public.enqueue_client_renewal_email(b text,certificate uuid,pic uuid,delivery_mode text,email_subject text,email_body text) returns uuid
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
revoke all on function public.enqueue_client_renewal_email(text,uuid,uuid,text,text,text) from public,anon;
grant execute on function public.enqueue_client_renewal_email(text,uuid,uuid,text,text,text) to authenticated;

create function public.enqueue_due_email_reminders(delivery_mode text) returns integer
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
revoke all on function public.enqueue_due_email_reminders(text) from public,anon,authenticated;
grant execute on function public.enqueue_due_email_reminders(text) to service_role;

create function public.claim_email_deliveries(batch_size integer,delivery_mode text,only_job uuid default null) returns setof public.email_outbox
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
  or (kind='reminder' and not exists(select 1 from public.profiles p join public.employee_directory e on e.id=p.employee_id and e.branch_code=p.branch_code join auth.users a on a.id=p.id
   where p.id=o.recipient_profile_id and p.branch_code=o.branch_code and p.is_active and p.retired_at is null and e.archived_at is null and e.employment_status<>'inactive' and a.email_confirmed_at is not null and lower(a.email)=o.recipient and lower(p.email)=o.recipient)));
 return query update public.email_outbox o set state='sending',claim_token=gen_random_uuid(),claimed_at=now(),attempt_count=attempt_count+1,updated_at=now()
 from (select id from public.email_outbox where state='pending' and mode=delivery_mode and next_attempt_at<=now() and (only_job is null or id=only_job)
  order by created_at for update skip locked limit greatest(1,least(batch_size,20))) selected where o.id=selected.id returning o.*;
end $$;
create function public.finish_email_delivery(job uuid,claim uuid,result_state text,result text,provider_request text,retry_seconds integer default 300) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' or result_state not in ('accepted','failed','uncertain','retry') then raise exception 'Worker only.' using errcode='42501';end if;
 update public.email_outbox set state=case when result_state='retry' and attempt_count<3 then 'pending' when result_state='retry' then 'failed' else result_state end,
  result_code=left(result,100),provider_request_id=left(provider_request,200),updated_at=now(),next_attempt_at=now()+make_interval(secs=>greatest(60,least(retry_seconds,86400)))
  where id=job and state='sending' and claim_token=claim;
 return found;
end $$;
revoke all on function public.claim_email_deliveries(integer,text,uuid),public.finish_email_delivery(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.claim_email_deliveries(integer,text,uuid),public.finish_email_delivery(uuid,uuid,text,text,text,integer) to service_role;
