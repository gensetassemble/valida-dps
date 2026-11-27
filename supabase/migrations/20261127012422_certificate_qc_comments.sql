create table public.certificate_qc_threads (
 id uuid primary key default gen_random_uuid(),
 branch_code text not null references public.branches(code),
 calibration_id uuid references public.calibrations(id),
 personnel_certificate_id uuid references public.personnel_certificates(id),
 domain text generated always as (case when calibration_id is not null then 'calibration' else 'personnel' end) stored,
 record_id uuid generated always as (coalesce(calibration_id,personnel_certificate_id)) stored,
 title text not null check(length(trim(title)) between 1 and 160),
 status text not null default 'open' check(status in ('open','in_progress','awaiting_qshe','closed')),
 version integer not null default 1,
 created_by uuid not null references public.profiles(id),
 request_key uuid not null,
 recipient_names text[] not null default '{}',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(num_nonnulls(calibration_id,personnel_certificate_id)=1),
 unique(created_by,request_key)
);
create index certificate_qc_record on public.certificate_qc_threads(branch_code,domain,record_id,updated_at desc);
create index certificate_qc_author on public.certificate_qc_threads(created_by);
create table public.certificate_qc_posts (
 id uuid primary key default gen_random_uuid(),thread_id uuid not null references public.certificate_qc_threads(id),
 author_id uuid not null references public.profiles(id),author_name text not null,
 operation text not null check(operation in ('open','reply','request_review','close','reopen')),
 body text not null default '' check(length(body)<=4000),
 resulting_status text not null, document_id uuid references public.operational_documents(id),
 request_key uuid not null,created_at timestamptz not null default now(),
 unique(thread_id,request_key)
);
create index certificate_qc_posts_thread on public.certificate_qc_posts(thread_id,created_at,id);
create index certificate_qc_posts_author on public.certificate_qc_posts(author_id);
create index certificate_qc_posts_document on public.certificate_qc_posts(document_id) where document_id is not null;
alter table public.certificate_qc_threads enable row level security;
alter table public.certificate_qc_posts enable row level security;

create function private.qc_record_scope(b text,d text,r uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and d in ('calibration','personnel') and private.document_scope(b,d,r,false);
$$;
create function private.qc_thread_scope(t uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.certificate_qc_threads q where q.id=t and private.qc_record_scope(q.branch_code,q.domain,q.record_id));
$$;
create policy qc_threads_read on public.certificate_qc_threads for select to authenticated using(private.qc_record_scope(branch_code,domain,record_id));
create policy qc_posts_read on public.certificate_qc_posts for select to authenticated using(private.qc_thread_scope(thread_id));
revoke all on public.certificate_qc_threads,public.certificate_qc_posts from anon,authenticated;
grant select on public.certificate_qc_threads,public.certificate_qc_posts to authenticated;

-- Resolve current operational owners, never the historical uploader.
create function private.qc_responsibles(b text,d text,r uuid) returns setof uuid
language sql stable security definer set search_path='' as $$
 select distinct p.id from public.profiles p
 join public.user_role_assignments a on a.profile_id=p.id and a.branch_code=b
 join public.roles role on role.code=a.role_code and role.is_active
 where p.is_active and a.is_active and a.revoked_at is null and (
  (d='personnel' and a.role_code='hrga') or
  (d='calibration' and a.role_code='equipment_manager' and exists(
    select 1 from public.calibrations c join public.equipment e on e.id=c.equipment_id and e.branch_code=c.branch_code
    where c.id=r and c.branch_code=b and (
      e.responsible_employee_id=p.employee_id or exists(
       select 1 from public.employee_portfolio_assignments x where x.employee_id=p.employee_id and x.branch_code=b and x.portfolio_id=e.portfolio_id
       and x.assignment_type='equipment_responsible' and x.is_active and x.verification_status='verified' and x.approved_at is not null
       and x.effective_from<=(now() at time zone 'Asia/Makassar')::date and (x.effective_until is null or x.effective_until>=(now() at time zone 'Asia/Makassar')::date)
      )
    )
  ))
 );
$$;

create function private.submit_certificate_qc(b text,d text,r uuid,t uuid,op text,message text,heading text,expected_version integer,request_id uuid,evidence uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare q public.certificate_qc_threads; post_id uuid; reviewer boolean; responder boolean; recipients uuid[]; label text; target text; next_status text; actor_name text;
begin
 if not private.qc_record_scope(b,d,r) then raise exception 'Akses catatan QC ditolak.' using errcode='42501';end if;
 reviewer:=private.has_role(b,array['qshe','super_admin']);
 responder:=private.has_role(b,array['super_admin']) or (d='personnel' and private.has_role(b,array['hrga'])) or (d='calibration' and private.has_role(b,array['equipment_manager']) and private.document_scope(b,d,r,true));
 if not (reviewer or responder) then raise exception 'Akses percakapan QC ditolak.' using errcode='42501';end if;
 if request_id is null or op not in ('open','reply','request_review','close','reopen') or length(coalesce(message,''))>4000 then raise exception 'Isian catatan tidak valid.';end if;
 select full_name into actor_name from public.profiles where id=auth.uid();
 if op='open' then
  if not reviewer then raise exception 'Temuan baru hanya oleh QSHE atau Super Admin.' using errcode='42501';end if;
  select * into q from public.certificate_qc_threads where created_by=auth.uid() and request_key=request_id;
  if found then
   if q.branch_code<>b or q.domain<>d or q.record_id<>r then raise exception 'Permintaan telah digunakan.';end if;
   return q.id;
  end if;
  if length(trim(coalesce(message,'')))<1 or length(trim(coalesce(heading,''))) not between 1 and 160 then raise exception 'Isi judul dan catatan temuan.';end if;
  insert into public.certificate_qc_threads(branch_code,calibration_id,personnel_certificate_id,title,created_by,request_key)
  values(b,case when d='calibration' then r end,case when d='personnel' then r end,trim(heading),auth.uid(),request_id) returning * into q;
 else
  select * into q from public.certificate_qc_threads where id=t and branch_code=b and domain=d and record_id=r for update;
  if not found then raise exception 'Temuan tidak tersedia.' using errcode='42501';end if;
  if exists(select 1 from public.certificate_qc_posts where thread_id=q.id and request_key=request_id and author_id=auth.uid()) then return q.id;end if;
  if q.version<>expected_version then raise exception 'Percakapan telah diperbarui. Muat ulang sebelum melanjutkan.' using errcode='40001';end if;
  if op in ('close','reopen') and not reviewer then raise exception 'Temuan hanya dapat diselesaikan/dibuka kembali oleh QSHE atau Super Admin.' using errcode='42501';end if;
  if op='reopen' and (q.status<>'closed' or length(trim(coalesce(message,'')))=0) then raise exception 'Tulis alasan membuka kembali temuan.';end if;
  if op<>'reopen' and q.status='closed' then raise exception 'Temuan sudah selesai. Buka kembali untuk melanjutkan.';end if;
  if op='reply' and length(trim(coalesce(message,'')))=0 then raise exception 'Tulis balasan terlebih dahulu.';end if;
  if op='request_review' and not responder then raise exception 'Permintaan pemeriksaan dikirim PTK/HRGA.' using errcode='42501';end if;
 end if;
 if evidence is not null and not exists(select 1 from public.operational_documents x where x.id=evidence and x.branch_code=b and x.domain=d and x.record_id=r) then raise exception 'Lampiran harus berasal dari sertifikat ini.' using errcode='42501';end if;
 next_status:=case op when 'open' then 'open' when 'reopen' then 'open' when 'close' then 'closed' when 'request_review' then 'awaiting_qshe' else case when responder then 'in_progress' else q.status end end;
 update public.certificate_qc_threads set status=next_status,version=case when op='open' then version else version+1 end,updated_at=now() where id=q.id;
 insert into public.certificate_qc_posts(thread_id,author_id,author_name,operation,body,resulting_status,document_id,request_key)
 values(q.id,auth.uid(),coalesce(nullif(actor_name,''),'Pengguna'),op,trim(coalesce(message,'')),next_status,evidence,request_id) returning id into post_id;
 if op in ('open','reopen','close') or (op='reply' and reviewer and not responder) then
  select array_agg(id) into recipients from private.qc_responsibles(b,d,r) as x(id);
  if coalesce(cardinality(recipients),0)=0 then
   select array_agg(distinct a.profile_id) into recipients from public.user_role_assignments a join public.profiles p on p.id=a.profile_id and p.is_active
   where a.branch_code=b and a.role_code='super_admin' and a.is_active and a.revoked_at is null;
  end if;
 else
  select array_agg(distinct p.id) into recipients from public.profiles p join public.user_role_assignments a on a.profile_id=p.id
  where p.id=q.created_by and p.is_active and a.branch_code=b and a.role_code in ('qshe','super_admin') and a.is_active and a.revoked_at is null;
  if coalesce(cardinality(recipients),0)=0 then
   select array_agg(distinct p.id) into recipients from public.profiles p join public.user_role_assignments a on a.profile_id=p.id
   where p.is_active and a.branch_code=b and a.role_code='super_admin' and a.is_active and a.revoked_at is null;
  end if;
 end if;
 update public.certificate_qc_threads set recipient_names=coalesce((select array_agg(full_name order by full_name) from public.profiles where id=any(recipients)),'{}') where id=q.id;
 target:=case when d='calibration' then '/peristiwa-kalibrasi/' else '/kompetensi-personil/' end||r||'?branch='||b||'#qc-'||q.id;
 label:=case op when 'open' then 'Temuan QC baru' when 'close' then 'Temuan QC selesai' when 'reopen' then 'Temuan QC dibuka kembali' when 'request_review' then 'Perbaikan siap diperiksa QSHE' else 'Balasan catatan QC' end;
 insert into public.user_notifications(branch_code,profile_id,event_id,title,href,qc_thread_id)
 select b,recipient,post_id,label||': '||q.title,target,q.id from unnest(recipients) recipient where recipient<>auth.uid() on conflict do nothing;
 insert into public.audit_logs(table_name,record_id,action,actor_id,new_values,branch_code,database_actor)
 values('certificate_qc_threads',q.id::text,case when op='open' then 'INSERT' else 'UPDATE' end,auth.uid(),jsonb_build_object('operation',op,'post_id',post_id,'status',next_status),b,session_user);
 return q.id;
end $$;

alter table public.user_notifications add column qc_thread_id uuid references public.certificate_qc_threads(id);
create index user_notifications_qc_thread on public.user_notifications(qc_thread_id) where qc_thread_id is not null;
create function public.submit_certificate_qc(b text,d text,r uuid,t uuid,op text,message text,heading text,expected_version integer,request_id uuid,evidence uuid default null)
returns uuid language sql security invoker set search_path='' as $$select private.submit_certificate_qc(b,d,r,t,op,message,heading,expected_version,request_id,evidence);$$;
revoke all on function private.qc_record_scope(text,text,uuid),private.qc_thread_scope(uuid),private.qc_responsibles(text,text,uuid),private.submit_certificate_qc(text,text,uuid,uuid,text,text,text,integer,uuid,uuid),public.submit_certificate_qc(text,text,uuid,uuid,text,text,text,integer,uuid,uuid) from public,anon,authenticated;
grant execute on function private.qc_record_scope(text,text,uuid),private.qc_thread_scope(uuid),private.submit_certificate_qc(text,text,uuid,uuid,text,text,text,integer,uuid,uuid),public.submit_certificate_qc(text,text,uuid,uuid,text,text,text,integer,uuid,uuid) to authenticated;

create function public.qc_permissions(b text,d text,r uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('respond',private.qc_record_scope(b,d,r) and (private.has_role(b,array['super_admin'])
 or (d='personnel' and private.has_role(b,array['hrga']))
 or (d='calibration' and private.has_role(b,array['equipment_manager']) and private.document_scope(b,d,r,true))));
$$;
revoke all on function public.qc_permissions(text,text,uuid) from public,anon;
grant execute on function public.qc_permissions(text,text,uuid) to authenticated;

create function private.qc_notification_context(notification uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('context_name',case when q.domain='calibration' then 'Sertifikat kalibrasi alat' else 'Sertifikat kompetensi personil' end,
 'entity_title',q.title,'event_status','qc_'||p.resulting_status,'current_status','qc_'||q.status,'event_notes',p.body,
 'activity_group_id','qc:'||q.id,'target_href',n.href)
 from public.user_notifications n join public.certificate_qc_threads q on q.id=n.qc_thread_id
 join public.certificate_qc_posts p on p.id=n.event_id and p.thread_id=q.id
 where n.id=notification and n.profile_id=auth.uid();
$$;
revoke all on function private.qc_notification_context(uuid) from public,anon;
grant execute on function private.qc_notification_context(uuid) to authenticated;
do $$ declare definition text; begin
 definition:=pg_get_functiondef('private.notification_inbox_context(uuid)'::regprocedure);
 if position('begin' in definition)=0 then raise exception 'Notification context definition changed';end if;
 definition:=replace(definition,'begin',E'begin\n if exists(select 1 from public.user_notifications where id=notification and profile_id=auth.uid() and qc_thread_id is not null) then return coalesce(private.qc_notification_context(notification),''{}''::jsonb);end if;');
 execute definition;
 definition:=pg_get_viewdef('public.notification_inbox_records'::regclass,true);
 if position('WHEN n.href' in definition)=0 then raise exception 'Notification view definition changed';end if;
 definition:=regexp_replace(definition,'CASE\s+WHEN n.href','CASE WHEN n.qc_thread_id IS NOT NULL THEN ''qc''::text WHEN n.href');
 execute 'create or replace view public.notification_inbox_records with(security_invoker=true) as '||definition;
end $$;
