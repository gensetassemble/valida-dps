-- An explicitly stopped/current cycle takes precedence over inherited older progress.
create or replace view public.personnel_certificate_portfolios with(security_invoker=true) as
select c.*,array(select distinct a.portfolio_id from public.employee_portfolio_assignments a
 where a.employee_id=c.employee_id and a.branch_code=c.branch_code and a.is_active and a.verification_status='verified'
 and a.effective_from<=(now() at time zone 'Asia/Makassar')::date and (a.effective_until is null or a.effective_until>=(now() at time zone 'Asia/Makassar')::date)) as portfolio_ids,
 case
 when own.id is not null then case when own.history_deleted_at is null then own.status else 'unprocessed' end
 when exists(select 1 from public.personnel_renewal_cases stopped where stopped.certificate_id=c.id and stopped.branch_code=c.branch_code and stopped.status='cancelled') then 'unprocessed'
 when prior.history_deleted_at is null then coalesce(prior.status,'unprocessed')
 else 'unprocessed' end as renewal_status,
 case when own.status='renewed' then own.replacement_certificate_id end as superseded_by_certificate_id,
 prior.certificate_id as previous_certificate_id
from public.personnel_certificate_records c
left join public.personnel_renewal_cases own on own.certificate_id=c.id and own.branch_code=c.branch_code and own.status<>'cancelled'
left join public.personnel_renewal_cases prior on prior.replacement_certificate_id=c.id and prior.branch_code=c.branch_code and prior.status='renewed';
