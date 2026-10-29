-- Unknown ownership is explicit; source import never implies verification.
alter table public.equipment drop constraint equipment_ownership_check;
alter table public.equipment drop constraint equipment_check;
alter table public.equipment add constraint equipment_ownership_check check(ownership in ('internal','client','unknown'));
alter table public.equipment add constraint equipment_check check((ownership in ('internal','unknown') and client_id is null) or (ownership='client' and client_id is not null));
create or replace view public.renewal_board_records with(security_invoker=true) as
 select c.*,coalesce(o.stage,'uncontacted') as stage,o.id as opportunity_id,c.previous_order_value::text as previous_order_value_text
 from public.client_certificate_records c left join public.renewal_opportunities o on o.certificate_id=c.id
 where c.is_active and c.verification_status='verified' and c.expiry_date is not null
 and (c.expiry_date<=(now() at time zone 'Asia/Makassar')::date+90 or o.id is not null)
 and not exists(select 1 from public.client_certificates newer where newer.previous_certificate_id=c.id and newer.is_active and newer.verification_status='verified');
