-- Remove the attachment first, then clean up its private blob through Storage API.
-- The ledger makes a failed Storage request safely retryable without restoring access.
create table private.removed_operational_documents (
 id uuid primary key,
 branch_code text not null,
 domain text not null,
 record_id uuid not null,
 object_path text not null unique,
 metadata jsonb not null,
 removed_by uuid not null,
 removed_at timestamptz not null default now(),
 cleaned_at timestamptz
);
alter table private.removed_operational_documents enable row level security;
revoke all on private.removed_operational_documents from public,anon,authenticated;

create function private.remove_operational_document(doc uuid,b text,d text,r uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.operational_documents; removed private.removed_operational_documents;
begin
 if auth.uid() is null or not private.document_scope(b,d,r,true) then
  raise exception 'Akses hapus lampiran ditolak.' using errcode='42501';
 end if;
 select * into item from public.operational_documents where id=doc and branch_code=b and domain=d and record_id=r for update;
 if not found then
  select * into removed from private.removed_operational_documents
   where id=doc and branch_code=b and domain=d and record_id=r and removed_by=auth.uid();
  if not found then raise exception 'Lampiran tidak tersedia.' using errcode='P0002';end if;
  return jsonb_build_object('id',removed.id,'object_path',removed.object_path,'cleanup_pending',removed.cleaned_at is null);
 end if;
 -- FK references from renewal_events / renewal_communications deliberately block
 -- deleting a PDF that has already become evidence for a recorded business stage.
 insert into private.removed_operational_documents(id,branch_code,domain,record_id,object_path,metadata,removed_by)
 values(item.id,item.branch_code,item.domain,item.record_id,item.object_path,to_jsonb(item),auth.uid());
 delete from public.operational_documents where id=item.id;
 return jsonb_build_object('id',item.id,'object_path',item.object_path,'cleanup_pending',true);
end $$;
create function public.remove_operational_document(doc uuid,b text,d text,r uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select private.remove_operational_document(doc,b,d,r);
$$;

create function private.document_cleanup_scope(path text)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from private.removed_operational_documents x
  where x.object_path=path and x.removed_by=auth.uid() and x.cleaned_at is null
  and private.document_scope(x.branch_code,x.domain,x.record_id,true)
 );
$$;
create function private.finish_document_cleanup(doc uuid)
returns void language plpgsql security definer set search_path='' as $$
declare item private.removed_operational_documents;
begin
 select * into item from private.removed_operational_documents where id=doc for update;
 if auth.uid() is null or not found or item.removed_by<>auth.uid()
  or not private.document_scope(item.branch_code,item.domain,item.record_id,true) then
  raise exception 'Akses pembersihan ditolak.' using errcode='42501';
 end if;
 if exists(select 1 from storage.objects where bucket_id='certificate-documents' and name=item.object_path) then
  raise exception 'Berkas belum dibersihkan.';
 end if;
 update private.removed_operational_documents set cleaned_at=coalesce(cleaned_at,now()) where id=doc;
end $$;
create function public.finish_document_cleanup(doc uuid)
returns void language sql security invoker set search_path='' as $$select private.finish_document_cleanup(doc);$$;

revoke all on function private.remove_operational_document(uuid,text,text,uuid), public.remove_operational_document(uuid,text,text,uuid),
 private.document_cleanup_scope(text), private.finish_document_cleanup(uuid), public.finish_document_cleanup(uuid) from public,anon,authenticated;
grant execute on function private.remove_operational_document(uuid,text,text,uuid), public.remove_operational_document(uuid,text,text,uuid),
 private.document_cleanup_scope(text), private.finish_document_cleanup(uuid), public.finish_document_cleanup(uuid) to authenticated;

drop trigger audit_document_metadata on public.operational_documents;
create trigger audit_document_metadata after insert or delete on public.operational_documents
 for each row execute function private.audit_business_record();

-- Deleted identifiers may not be reinserted to regain access to an old object.
create function private.guard_removed_document() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.removed_operational_documents where id=new.id or object_path=new.object_path) then
  raise exception 'Lampiran yang dihapus tidak dapat ditautkan kembali.';
 end if;
 return new;
end $$;
revoke all on function private.guard_removed_document() from public,anon,authenticated;
create trigger guard_removed_document before insert on public.operational_documents
 for each row execute function private.guard_removed_document();

alter policy certificate_documents_closed on storage.objects using(
 bucket_id<>'certificate-documents'
 or exists(select 1 from public.operational_documents d where d.object_path=name)
 or private.document_cleanup_scope(name)
);
create policy operational_pdf_cleanup_read on storage.objects for select to authenticated
 using(bucket_id='certificate-documents' and private.document_cleanup_scope(name));
create policy operational_pdf_cleanup_delete on storage.objects for delete to authenticated
 using(bucket_id='certificate-documents' and private.document_cleanup_scope(name));
-- No direct metadata DELETE grant: the scoped, audited RPC is the only entry point.
