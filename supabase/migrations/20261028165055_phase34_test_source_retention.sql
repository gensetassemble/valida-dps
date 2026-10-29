-- Only a privileged database operator may mark a synthetic batch. App roles have no table UPDATE.
-- Real source batches retain is_example=false and cannot be deleted from Storage by app users.
alter table public.import_batches add column is_example boolean not null default false;
create policy import_synthetic_cleanup on storage.objects for delete to authenticated
 using(bucket_id='import-sources' and exists(select 1 from public.import_batches b where b.is_example
 and b.branch_code=(storage.foldername(name))[1] and b.id::text=(storage.foldername(name))[2]
 and private.has_role(b.branch_code,array['admin'])));
