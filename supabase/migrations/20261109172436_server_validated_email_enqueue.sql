-- Only the server action can supply a canonical, confirmed message to this queue.
create or replace function public.enqueue_client_renewal_email(b text,certificate uuid,pic uuid,delivery_mode text,email_subject text,email_body text,actor_id uuid,expected_revision text,template_version integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.client_certificate_display_records; r public.client_contacts; target text; k text; job uuid; rev text;
begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'Server queue only.' using errcode='42501';end if;
 if not (private.target_has_role(actor_id,b,'super_admin') or private.target_has_role(actor_id,b,'admin') or private.target_has_role(actor_id,b,'account_manager')) then raise exception 'Akses email ditolak.' using errcode='42501';end if;
 select * into c from public.client_certificate_display_records where id=certificate and branch_code=b and is_active and not is_example and superseded_by_certificate_id is null;
 if c.id is null then raise exception 'Sertifikat tidak tersedia.' using errcode='42501';end if;
 if delivery_mode='test' then
  if not (private.target_has_role(actor_id,b,'super_admin') or private.target_has_role(actor_id,b,'admin')) then raise exception 'Uji email hanya oleh Admin.' using errcode='42501';end if;
  target:='adli.alfian@sucofindo.co.id';
 elsif delivery_mode='live' then
  select * into r from public.client_contacts where id=pic and client_id=c.client_id and branch_code=b and is_active and is_primary and not is_test and verification_status='verified';
  if r.id is null or r.email is null then raise exception 'PIC utama resmi terverifikasi diperlukan.';end if;
  target:=lower(trim(r.email));
 else raise exception 'Mode pengiriman tidak valid.';end if;
 select revision into rev from private.email_reminder_sources where domain='clients' and id=c.id and branch_code=b;
 if rev is null or rev is distinct from expected_revision then raise exception 'Pratinjau sertifikat telah berubah.' using errcode='40001';end if;
 if coalesce((select max(version) from public.client_renewal_email_templates where branch_code=b),0) is distinct from template_version then raise exception 'Template telah berubah.' using errcode='40001';end if;
 k:=concat_ws(':','renewal',b,c.id,delivery_mode,rev,md5(concat_ws('|',target,email_subject,email_body)));
 insert into public.email_outbox(branch_code,kind,mode,domain,record_id,recipient,contact_id,subject,body,source_revision,dedupe_key,created_by)
 values(b,'renewal',delivery_mode,'clients',c.id,target,case when delivery_mode='live' then r.id end,email_subject,email_body,rev,k,actor_id)
 on conflict(dedupe_key) do nothing returning id into job;
 if job is null then select id into job from public.email_outbox where dedupe_key=k;end if;
 return job;
end $$;
revoke all on function public.enqueue_client_renewal_email(text,uuid,uuid,text,text,text,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.enqueue_client_renewal_email(text,uuid,uuid,text,text,text,uuid,text,integer) to service_role;
revoke all on function public.enqueue_client_renewal_email(text,uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
