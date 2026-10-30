-- Organization directory is readable by branch accounts in the approved module matrix.
-- Certificate visibility continues to use employee_scope; business readers cannot write.
alter policy employees_read on public.employee_directory using(private.branch_access(branch_code));
