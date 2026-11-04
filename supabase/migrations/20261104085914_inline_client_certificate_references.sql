-- Only add client-category types; other catalog edits remain restricted.
do $migration$
declare definition text; original text := $$allowed:=private.has_role(b,array['admin']) or (tg_op='INSERT' and new.category='personnel' and private.has_role(b,array['hrga']));$$;
begin
  definition:=pg_get_functiondef('private.authorize_mutation()'::regprocedure);
  if position(original in definition)=0 then raise exception 'Unexpected mutation guard definition'; end if;
  execute replace(definition,original,original || $$
  allowed:=allowed or (tg_op='INSERT' and new.category='client' and private.has_role(b,array['account_manager']));$$);
end $migration$;
create policy client_type_insert on public.certificate_types for insert to authenticated
  with check(category='client' and private.has_role(branch_code,array['account_manager']));

create function public.create_client_certificate_reference(b text,reference_kind text,reference_name text)
returns table(id uuid,name text) language plpgsql security invoker set search_path='' as $$
declare normalized text:=regexp_replace(trim(reference_name),'\s+',' ','g'); found_id uuid;
begin
  if auth.uid() is null or not private.has_role(b,array['admin','account_manager']) then
    raise exception 'Penambahan hanya untuk Admin atau AM pada cabang ini.' using errcode='42501';
  end if;
  if reference_kind not in ('client_id','certificate_type_id') or reference_kind is null then
    raise exception 'Jenis pilihan tidak tersedia.' using errcode='22023';
  end if;
  if normalized is null or length(normalized) not between 2 and 160 then
    raise exception 'Isi nama 2–160 karakter.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(b||':client-reference:'||reference_kind||':'||lower(normalized),0));
  if reference_kind='client_id' then
    select c.id into found_id from public.clients c where c.branch_code=b and not c.is_example
      and lower(regexp_replace(trim(c.name),'\s+',' ','g'))=lower(normalized)
      order by c.is_active desc,c.id limit 1;
    if found_id is not null then
      if not exists(select 1 from public.clients c where c.id=found_id and c.is_active) then
        raise exception 'Pelanggan sudah ada tetapi nonaktif. Hubungi Admin untuk memulihkannya.';
      end if;
    else
      insert into public.clients(branch_code,name,account_manager_id,is_active,verification_status)
        values(b,normalized,auth.uid(),true,'pending') returning clients.id into found_id;
    end if;
    return query select c.id,c.name from public.clients c where c.id=found_id;
  else
    select t.id into found_id from public.certificate_types t where t.branch_code=b and t.category='client'
      and lower(regexp_replace(trim(t.name),'\s+',' ','g'))=lower(normalized)
      order by t.is_active desc,t.id limit 1;
    if found_id is not null then
      if not exists(select 1 from public.certificate_types t where t.id=found_id and t.is_active) then
        raise exception 'Jenis sertifikat sudah ada tetapi nonaktif. Hubungi Admin untuk memulihkannya.';
      end if;
    else
      insert into public.certificate_types(branch_code,code,name,category,is_active)
        values(b,'CL-'||gen_random_uuid()::text,normalized,'client',true) returning certificate_types.id into found_id;
    end if;
    return query select t.id,t.name from public.certificate_types t where t.id=found_id;
  end if;
end $$;
revoke all on function public.create_client_certificate_reference(text,text,text) from public,anon;
grant execute on function public.create_client_certificate_reference(text,text,text) to authenticated;
