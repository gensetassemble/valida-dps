create function private.client_am_label(b text,c uuid) returns text language sql stable security definer set search_path='' as $$
 select case when auth.uid() is not null and private.client_scope(b,c) then coalesce(cl.example_am_label,p.full_name) end
 from public.clients cl left join public.profiles p on p.id=cl.account_manager_id where cl.id=c and cl.branch_code=b;
$$;
revoke all on function private.client_am_label(text,uuid) from public,anon,authenticated;
grant execute on function private.client_am_label(text,uuid) to authenticated;
create or replace view public.client_certificate_display_records with(security_invoker=true) as
 select c.*,c.previous_order_value::text as previous_order_value_text,w.name as work_area_name,private.client_am_label(c.branch_code,c.client_id) as account_manager_name
 from public.client_certificate_records c left join public.work_areas w on w.id=c.work_area_id and w.branch_code=c.branch_code;
