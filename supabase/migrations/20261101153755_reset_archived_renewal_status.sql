-- Archive resets the displayed process status, while certificate lineage remains intact.
create or replace view public.personnel_certificate_portfolios with(security_invoker=true) as
select c.*,array(select distinct a.portfolio_id from public.employee_portfolio_assignments a
 where a.employee_id=c.employee_id and a.branch_code=c.branch_code and a.is_active and a.verification_status='verified'
 and a.effective_from<=(now() at time zone 'Asia/Makassar')::date and (a.effective_until is null or a.effective_until>=(now() at time zone 'Asia/Makassar')::date)) as portfolio_ids,
 coalesce(case when own.history_deleted_at is null then own.status end,case when prior.history_deleted_at is null then prior.status end,'unprocessed') as renewal_status,
 case when own.status='renewed' then own.replacement_certificate_id end as superseded_by_certificate_id,
 prior.certificate_id as previous_certificate_id
from public.personnel_certificate_records c
left join public.personnel_renewal_cases own on own.certificate_id=c.id and own.branch_code=c.branch_code and own.status<>'cancelled'
left join public.personnel_renewal_cases prior on prior.replacement_certificate_id=c.id and prior.branch_code=c.branch_code and prior.status='renewed';
