alter table public.portfolios add column marketing_contact_id uuid;
alter table public.portfolios add constraint portfolios_marketing_contact_branch_fk foreign key(marketing_contact_id,branch_code) references public.marketing_contacts(id,branch_code);
create index portfolios_marketing_contact_idx on public.portfolios(marketing_contact_id,branch_code);
create view public.portfolio_pic_records with(security_invoker=true) as
select p.*,m.full_name as marketing_pic_name from public.portfolios p
left join public.marketing_contacts m on m.id=p.marketing_contact_id and m.branch_code=p.branch_code;
revoke all on public.portfolio_pic_records from public,anon;
grant select on public.portfolio_pic_records to authenticated;

-- Return exact totals and all six stage slices from one authorized scan.
create function public.renewal_board_page(b text,search_text text default '',include_examples boolean default true,stage_limits jsonb default '{}')
returns jsonb language sql stable security invoker set search_path='' as $$
 with visible as materialized (
  select r.* from public.renewal_board_display_records r where r.branch_code=b and (include_examples or not r.is_example)
  and not exists(select 1 from regexp_split_to_table(left(trim(coalesce(search_text,'')),100),'\s+') term
   where term<>'' and concat_ws(' ',r.client_name,r.certificate_number,r.object_type,r.certificate_type_name,r.account_manager_name) not ilike '%'||term||'%')
 ), ranked as (
  select v.*,row_number() over(partition by stage order by expiry_date nulls last,id) as position_in_stage from visible v
 ), totals as (
  select stage,count(*) n,coalesce(sum(previous_order_value),0)::text amount,count(*) filter(where is_example) examples from visible group by stage
 ), slices as (
  select stage,jsonb_agg(to_jsonb(r)-'position_in_stage' order by expiry_date nulls last,id) rows
  from ranked r where position_in_stage <= case when stage_limits->>stage ~ '^[1-9][0-9]{0,3}$' then least(1000,(stage_limits->>stage)::integer) else 20 end group by stage
 )
 select jsonb_build_object('summary',coalesce((select jsonb_object_agg(stage,jsonb_build_object('count',n,'amount',amount,'examples',examples)) from totals),'{}'),
 'columns',coalesce((select jsonb_object_agg(stage,rows) from slices),'{}'));
$$;
revoke all on function public.renewal_board_page(text,text,boolean,jsonb) from public,anon;
grant execute on function public.renewal_board_page(text,text,boolean,jsonb) to authenticated;

-- Existing explicit page callers keep their contract; scrolling summary asks for cumulative rows.
do $migration$ declare definition text;needle text;begin
 definition:=pg_get_functiondef('public.operational_summary(text,jsonb)'::regprocedure);
 needle:='limit 20 offset ((case when filters->>''page'' ~ ''^[1-9][0-9]{0,4}$'' then (filters->>''page'')::integer else 1 end)-1)*20';
 if position(needle in definition)=0 then raise exception 'Expected summary pagination contract';end if;
 definition:=replace(definition,needle,'limit (case when filters->>''scroll''=''true'' then least(1000,(case when filters->>''page'' ~ ''^[1-9][0-9]{0,4}$'' then (filters->>''page'')::integer else 1 end)*20) else 20 end) offset (case when filters->>''scroll''=''true'' then 0 else ((case when filters->>''page'' ~ ''^[1-9][0-9]{0,4}$'' then (filters->>''page'')::integer else 1 end)-1)*20 end)');
 execute definition;
end $migration$;
