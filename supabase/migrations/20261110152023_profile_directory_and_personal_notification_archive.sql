-- Extend the existing invoker RPC without changing its authorization predicates.
do $$ declare definition text; needle text; begin
 definition:=pg_get_functiondef('public.save_profile_identity(text,uuid,jsonb)'::regprocedure);
 needle:='''full_name'',''email'',''npp'',''whatsapp'',''is_active''';
 if position(needle in definition)=0 then raise exception 'Profile definition changed; review required';end if;
 definition:=replace(definition,needle,needle||',''employee_id''');
 needle:='if profile is null then';
 if position(needle in definition)=0 then raise exception 'Profile insert definition changed';end if;
 definition:=replace(definition,needle,$block$
 if nullif(details->>'employee_id','') is not null then
  select e.id into emp from public.employee_directory e where e.id=(details->>'employee_id')::uuid and e.branch_code=b and e.archived_at is null and e.merged_into_employee_id is null;
  if emp is null then raise exception 'Pegawai tidak tersedia pada direktori cabang' using errcode='23514';end if;
  select details || jsonb_build_object('full_name',e.full_name,'npp',e.npp) into details from public.employee_directory e where e.id=emp and e.branch_code=b;
 end if;
 if profile is null then
 $block$);
 execute definition;
end $$;

-- A personal inbox preference. Archiving never deletes the delivery or its audit.
create table public.notification_archive_preferences (
 notification_id uuid primary key references public.user_notifications(id) on delete cascade,
 profile_id uuid not null references public.profiles(id),
 archived_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.notification_archive_preferences enable row level security;
revoke all on public.notification_archive_preferences from public,anon;
grant select,insert,update on public.notification_archive_preferences to authenticated;
create policy own_notification_archive on public.notification_archive_preferences for all to authenticated
 using (profile_id=(select auth.uid()) and private.actor_enabled() and exists(select 1 from public.user_notifications n where n.id=notification_id and n.profile_id=(select auth.uid()) and private.branch_access(n.branch_code)))
 with check (profile_id=(select auth.uid()) and private.actor_enabled() and exists(select 1 from public.user_notifications n where n.id=notification_id and n.profile_id=(select auth.uid()) and private.branch_access(n.branch_code)));
create view public.notification_user_feed with(security_invoker=true) as
 select n.*,p.archived_at as user_archived_at from public.notification_inbox_records n
 left join public.notification_archive_preferences p on p.notification_id=n.id and p.profile_id=n.profile_id;
revoke all on public.notification_user_feed from public,anon;
grant select on public.notification_user_feed to authenticated;
