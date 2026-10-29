create index import_rows_batch_branch_idx on public.import_rows(batch_id,branch_code);
create view public.client_certificate_display_records with(security_invoker=true) as
 select c.*,c.previous_order_value::text as previous_order_value_text from public.client_certificate_records c;
revoke all on public.client_certificate_display_records from public,anon,authenticated;
grant select on public.client_certificate_display_records to authenticated;
create or replace view public.renewal_board_records with(security_invoker=true) as
 select c.*,coalesce(o.stage,'uncontacted') as stage,o.id as opportunity_id,c.previous_order_value::text as previous_order_value_text
 from public.client_certificate_records c left join public.renewal_opportunities o on o.certificate_id=c.id where c.is_active;
