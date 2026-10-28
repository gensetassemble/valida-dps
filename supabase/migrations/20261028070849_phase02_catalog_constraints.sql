-- Codes identify a certificate type uniquely; row authorization remains branch-scoped.
alter table public.certificate_types add constraint certificate_types_code_key unique(code);
alter table public.certificate_types drop constraint certificate_types_branch_code_code_key;
update public.branches set region='Bali, NTB, NTT' where code='DPS' and region is null;
