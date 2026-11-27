-- The existing per-finding function remains authoritative for scope, roles,
-- notifications and audit. Any failure rolls back this entire RPC call.
create function public.submit_certificate_qc_batch(b text,d text,r uuid,findings jsonb)
returns uuid[] language plpgsql security invoker set search_path='' as $$
declare item jsonb; key uuid; keys uuid[]:='{}'; ids uuid[]:='{}'; existing record;
begin
 if auth.uid() is null or not private.qc_record_scope(b,d,r) or not private.has_role(b,array['qshe','super_admin']) then
  raise exception 'Akses pengiriman temuan ditolak.' using errcode='42501';
 end if;
 if findings is null or jsonb_typeof(findings)<>'array' then
  raise exception 'Poin temuan harus berupa daftar.' using errcode='22023';
 end if;
 if jsonb_array_length(findings) not between 1 and 20 then
  raise exception 'Isi 1 sampai 20 poin temuan.' using errcode='22023';
 end if;
 for item in select value from jsonb_array_elements(findings) loop
  if jsonb_typeof(item)<>'object' or item-'requestId'-'title'-'body'<>'{}'::jsonb
    or jsonb_typeof(item->'requestId') is distinct from 'string'
    or jsonb_typeof(item->'title') is distinct from 'string'
    or jsonb_typeof(item->'body') is distinct from 'string'
    or length(trim(item->>'title')) not between 1 and 160
    or length(trim(item->>'body')) not between 1 and 4000 then
   raise exception 'Lengkapi judul dan catatan setiap poin.' using errcode='22023';
  end if;
  key:=(item->>'requestId')::uuid;
  if key=any(keys) then raise exception 'Poin temuan terduplikasi.' using errcode='22023';end if;
  keys:=array_append(keys,key);
  select q.branch_code,q.domain,q.record_id,q.title,p.body into existing
  from public.certificate_qc_threads q join public.certificate_qc_posts p on p.thread_id=q.id and p.operation='open' and p.request_key=q.request_key
  where q.created_by=auth.uid() and q.request_key=key;
  if found and (existing.branch_code<>b or existing.domain<>d or existing.record_id<>r
    or existing.title<>trim(item->>'title') or existing.body<>trim(item->>'body')) then
   raise exception 'Pengiriman ini sudah tersimpan dengan isian berbeda. Muat ulang.' using errcode='22023';
  end if;
 end loop;
 for item in select value from jsonb_array_elements(findings) loop
  ids:=array_append(ids,public.submit_certificate_qc(b,d,r,null,'open',trim(item->>'body'),trim(item->>'title'),0,(item->>'requestId')::uuid,null));
 end loop;
 return ids;
end $$;
revoke all on function public.submit_certificate_qc_batch(text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.submit_certificate_qc_batch(text,text,uuid,jsonb) to authenticated;
