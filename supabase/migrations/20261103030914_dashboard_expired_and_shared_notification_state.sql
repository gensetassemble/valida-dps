-- Keep all existing role/branch predicates. Only expand the bounded priority list.
do $$ declare definition text; needle text; replacement text; begin
 definition:=pg_get_functiondef('public.operational_summary(text,jsonb)'::regprocedure);
 needle:='soon as(select * from visible where expiry_date between (now() at time zone ''Asia/Makassar'')::date and (now() at time zone ''Asia/Makassar'')::date+90 and validity_status not in (''Tanggal Belum Diisi'',''Berlaku Seumur Hidup'') order by expiry_date,id limit 20)';
 replacement:='soon as((select * from visible where expiry_date < (now() at time zone ''Asia/Makassar'')::date and validity_status not in (''Tanggal Belum Diisi'',''Berlaku Seumur Hidup'') order by expiry_date desc,id limit 20) union all (select * from visible where expiry_date between (now() at time zone ''Asia/Makassar'')::date and (now() at time zone ''Asia/Makassar'')::date+90 and validity_status not in (''Tanggal Belum Diisi'',''Berlaku Seumur Hidup'') order by expiry_date,id limit 20))';
 if position(needle in definition)=0 then raise exception 'Dashboard priority definition changed; review required.';end if;
 execute replace(definition,needle,replacement);
end $$;

-- Original events remain immutable. Each recipient resolves the same live source status
-- through their existing RLS, instead of treating an old delivery as the current state.
do $$ declare definition text; needle text;begin
 definition:=pg_get_functiondef('private.notification_inbox_context(uuid)'::regprocedure);
 needle:='''event_status'',work->>''event_status'',''event_notes''';
 if position(needle in definition)=0 then raise exception 'Notification context definition changed; review required.';end if;
 execute replace(definition,needle,'''current_status'',case when work->>''history_deleted_at'' is null then work->>''status'' else ''unprocessed'' end,''event_status'',work->>''event_status'',''event_notes''');
end $$;

create or replace view public.notification_inbox_records with(security_invoker=true) as
select n.id,n.branch_code,n.profile_id,n.event_id,n.title,n.href,n.read_at,n.created_at,n.updated_at,
 case when n.href like '/kompetensi-personil/%' then 'personnel' when n.href like '/kalibrasi-alat/%' then 'calibrations' when n.href like '/sertifikat-klien/%' then 'clients' else 'system' end as category,
 ctx.value->>'event_status' as event_status,ctx.value->>'context_name' as context_name,ctx.value->>'entity_title' as entity_title,
 ctx.value->>'reference_number' as reference_number,ctx.value->>'replacement_certificate_number' as replacement_certificate_number,
 ctx.value->>'portfolio_code' as portfolio_code,(ctx.value->>'expires_on')::date as expires_on,
 ctx.value->>'event_notes' as event_notes,ctx.value->>'activity_group_id' as activity_group_id,
 ctx.value->>'target_href' as target_href,coalesce((ctx.value->>'process_reset')::boolean,false) as process_reset,
 concat_ws(' ',n.title,ctx.value->>'context_name',ctx.value->>'entity_title',ctx.value->>'reference_number',ctx.value->>'replacement_certificate_number',ctx.value->>'portfolio_code',ctx.value->>'current_status') as search_text,
 ctx.value->>'current_status' as current_status
from public.user_notifications n
cross join lateral (select private.notification_inbox_context(n.id) as value offset 0) ctx
where n.archived_at is null;
