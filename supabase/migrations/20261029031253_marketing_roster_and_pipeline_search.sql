create table public.marketing_contacts(
 id uuid primary key default gen_random_uuid(),branch_code text not null references public.branches(code),
 full_name text not null check(length(trim(full_name)) between 2 and 160),is_active boolean not null default true,
 created_at timestamptz not null default now(),unique(id,branch_code),unique(branch_code,full_name)
);
alter table public.marketing_contacts enable row level security;
create policy marketing_contacts_read on public.marketing_contacts for select to authenticated using(private.branch_access(branch_code));
revoke all on public.marketing_contacts from public,anon,authenticated;
grant select on public.marketing_contacts to authenticated;
alter table public.clients add column marketing_contact_id uuid;
alter table public.clients add constraint clients_marketing_contact_branch_fk foreign key(marketing_contact_id,branch_code) references public.marketing_contacts(id,branch_code);
create index clients_marketing_contact_idx on public.clients(marketing_contact_id,branch_code);

-- Business roster labels do not grant login or client access; account_manager_id remains the RLS assignee.
create or replace function private.client_am_label(b text,c uuid) returns text language sql stable security definer set search_path='' as $$
 select case when auth.uid() is not null and private.client_scope(b,c) then coalesce(m.full_name,cl.example_am_label,p.full_name) end
 from public.clients cl left join public.profiles p on p.id=cl.account_manager_id
 left join public.marketing_contacts m on m.id=cl.marketing_contact_id and m.branch_code=cl.branch_code
 where cl.id=c and cl.branch_code=b;
$$;
create or replace view public.client_certificate_display_records with(security_invoker=true) as
select c.*,c.previous_order_value::text as previous_order_value_text,w.name as work_area_name,
 private.client_am_label(c.branch_code,c.client_id) as account_manager_name,cl.marketing_contact_id
from public.client_certificate_records c left join public.work_areas w on w.id=c.work_area_id and w.branch_code=c.branch_code
join public.clients cl on cl.id=c.client_id and cl.branch_code=c.branch_code;
create view public.renewal_board_display_records with(security_invoker=true) as
select r.*,private.client_am_label(r.branch_code,r.client_id) as account_manager_name,cl.marketing_contact_id
from public.renewal_board_records r join public.clients cl on cl.id=r.client_id and cl.branch_code=r.branch_code;
revoke all on public.renewal_board_display_records from public,anon;
grant select on public.renewal_board_display_records to authenticated;

create function public.pipeline_search_totals(b text,search_text text default '',include_examples boolean default true)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_object_agg(x.stage,jsonb_build_object('count',x.n,'amount',x.amount,'examples',x.examples)),'{}'::jsonb)
 from(select r.stage,count(*) n,sum(r.previous_order_value)::text amount,count(*) filter(where r.is_example) examples
 from public.renewal_board_display_records r where r.branch_code=b and (include_examples or not r.is_example)
 and not exists(select 1 from regexp_split_to_table(left(trim(coalesce(search_text,'')),100),'\s+') term
 where term<>'' and concat_ws(' ',r.client_name,r.certificate_number,r.object_type,r.certificate_type_name,r.account_manager_name) not ilike '%'||term||'%')
 group by r.stage)x;
$$;
revoke all on function public.pipeline_search_totals(text,text,boolean) from public,anon;
grant execute on function public.pipeline_search_totals(text,text,boolean) to authenticated;

do $migration$ declare definition text;needle text;begin
 definition:=pg_get_functiondef('public.operational_summary(text,jsonb)'::regprocedure);
 needle:='and (nullif(filters->>''am'','''') is null or r.account_manager_id::text=filters->>''am'')';
 if position(needle in definition)=0 then raise exception 'Expected summary filter contract';end if;
 definition:=replace(definition,needle,needle||E'\n and (nullif(filters->>''marketing'','''') is null or exists(select 1 from public.clients cl where cl.id=r.client_id and cl.branch_code=b and cl.marketing_contact_id::text=filters->>''marketing''))');
 execute definition;
end $migration$;
