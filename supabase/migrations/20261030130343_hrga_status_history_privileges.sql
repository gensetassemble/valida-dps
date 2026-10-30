-- Supabase default privileges can grant table writes; history is trigger-only.
revoke all on public.employee_status_events from public,anon,authenticated;
grant select on public.employee_status_events to authenticated;
