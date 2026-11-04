-- Additive, append-only template versions. Existing certificate/contact/pipeline
-- tables and their policies are intentionally unchanged.
create table public.client_renewal_email_templates (
 id uuid primary key default gen_random_uuid(),
 branch_code text not null references public.branches(code),
 version integer not null check(version>0),
 subject text not null check(length(subject) between 8 and 300 and subject !~ E'[\r\n]'),
 body text not null check(length(body) between 80 and 8000),
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(branch_code,version)
);
alter table public.client_renewal_email_templates enable row level security;
revoke all on public.client_renewal_email_templates from public,anon,authenticated;
grant select,insert on public.client_renewal_email_templates to authenticated;
create policy email_template_read on public.client_renewal_email_templates for select to authenticated
 using(private.has_role(branch_code,array['admin','account_manager']));
create policy email_template_insert on public.client_renewal_email_templates for insert to authenticated
 with check(private.has_role(branch_code,array['admin']) and created_by=auth.uid());

create function private.guard_client_email_template() returns trigger language plpgsql security invoker set search_path='' as $$
declare item text; placeholders text[]:=array['nama_pic_pelanggan','sapaan_pic','nama_pelanggan','nama_layanan','jenis_sertifikat','objek_pekerjaan','nomor_seri_objek','nomor_sertifikat','lokasi_pekerjaan','tanggal_berakhir','sisa_hari','kalimat_masa_berlaku'];
begin
 if auth.uid() is null or not private.has_role(new.branch_code,array['admin']) or new.created_by<>auth.uid() then raise exception 'Hanya Admin cabang dapat mengubah template.' using errcode='42501';end if;
 if new.subject not like '%{nama_layanan}%' then raise exception 'Subjek wajib memuat nama layanan.';end if;
 foreach item in array array['nama_pelanggan','nama_layanan','nomor_sertifikat','tanggal_berakhir','kalimat_masa_berlaku'] loop
  if position('{'||item||'}' in new.body)=0 then raise exception 'Placeholder wajib hilang: %',item;end if;
 end loop;
 for item in select m[1] from regexp_matches(new.subject||new.body,'\{([^{}]+)\}','g') m loop
  if not item=any(placeholders) then raise exception 'Placeholder tidak dikenal: %',item;end if;
 end loop;
 if regexp_replace(new.subject||new.body,'\{[^{}]+\}','','g') ~ '[{}]' then raise exception 'Placeholder tidak lengkap.';end if;
 if new.subject||new.body ~* '\[UJI|Tim Account Manager|Hormat kami|Bidang Penjualan dan Dukungan Operasi' then raise exception 'Label uji dan tanda tangan ditambahkan otomatis.';end if;
 return new;
end $$;
revoke all on function private.guard_client_email_template() from public,anon,authenticated;
create trigger guard_email_template before insert on public.client_renewal_email_templates for each row execute function private.guard_client_email_template();
create trigger audit_email_template after insert on public.client_renewal_email_templates for each row execute function private.audit_business_record();

create function public.save_client_renewal_email_template(b text,template_subject text,template_body text,expected_version integer)
returns integer language plpgsql security invoker set search_path='' as $$
declare latest integer;
begin
 if auth.uid() is null or not private.has_role(b,array['admin']) then raise exception 'Hanya Admin cabang dapat mengubah template.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('client-email-template:'||b,0));
 select coalesce(max(version),0) into latest from public.client_renewal_email_templates where branch_code=b;
 if expected_version is distinct from latest then raise exception 'Template telah berubah. Muat ulang sebelum menyimpan.' using errcode='40001';end if;
 insert into public.client_renewal_email_templates(branch_code,version,subject,body) values(b,latest+1,trim(template_subject),trim(template_body));
 return latest+1;
end $$;
revoke all on function public.save_client_renewal_email_template(text,text,text,integer) from public,anon;
grant execute on function public.save_client_renewal_email_template(text,text,text,integer) to authenticated;
