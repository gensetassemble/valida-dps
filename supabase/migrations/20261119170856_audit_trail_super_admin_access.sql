-- Resolve the administrator's readable branches once per statement. The old
-- row-correlated private.has_role() call made audit pagination and exact counts
-- re-check the complete identity/role graph for every ledger row.
alter policy audit_read on public.audit_logs
using (
  branch_code in (
    select b.code
    from public.branches b
    where b.is_active
      and private.has_role(b.code, array['admin'])
  )
);

-- The application opens the ledger newest-first. Include the immutable id as a
-- deterministic pagination tiebreaker without sorting the JSON audit payload.
create index if not exists audit_branch_occurred_id_idx
  on public.audit_logs(branch_code, occurred_at desc, id);
