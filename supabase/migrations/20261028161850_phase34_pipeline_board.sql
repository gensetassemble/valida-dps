create or replace function private.transition_renewal(cert uuid,target text,note text,doc uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.client_certificates;o public.renewal_opportunities;required_kind text;
begin
 select * into c from public.client_certificates where id=cert;
 if not found or not private.client_scope(c.branch_code,c.client_id,true) then raise exception 'Akses pipeline ditolak.' using errcode='42501';end if;
 if length(trim(note)) not between 8 and 2000 then raise exception 'Catatan kontak/alasan diperlukan.';end if;
 insert into public.renewal_opportunities(certificate_id,client_id,branch_code) values(c.id,c.client_id,c.branch_code) on conflict(certificate_id) do nothing;
 select * into o from public.renewal_opportunities where certificate_id=cert for update;
 if target='contacted' and o.stage='uncontacted' then
  if not exists(select 1 from public.client_contacts x where x.client_id=c.client_id and x.branch_code=c.branch_code and x.is_active and x.is_primary and x.verification_status='verified') then raise exception 'PIC utama yang terverifikasi diperlukan sebelum pencatatan kontak.';end if;
 elsif target='offered' and o.stage='contacted' then required_kind:='quotation';
 elsif target='po_received' and o.stage='offered' then required_kind:='purchase_order';
 elsif target in ('deferred','not_renewed') and o.stage in ('uncontacted','contacted','offered','deferred') and o.stage<>target then null;
 elsif target='contacted' and o.stage='deferred' then null;
 else raise exception 'Transisi ditolak oleh gerbang bisnis.';end if;
 if required_kind is not null and not exists(select 1 from public.operational_documents d join storage.objects s on s.name=d.object_path and s.bucket_id='certificate-documents'
 where d.id=doc and d.domain='client' and d.record_id=c.id and d.kind=required_kind and d.branch_code=c.branch_code) then raise exception 'PDF penawaran/PO yang telah diunggah wajib tersedia.';end if;
 update public.renewal_opportunities set stage=target,updated_at=now() where id=o.id;
 insert into public.renewal_events(opportunity_id,branch_code,from_stage,to_stage,note,document_id,created_by) values(o.id,c.branch_code,o.stage,target,note,doc,auth.uid());
 insert into public.audit_logs(table_name,record_id,action,actor_id,old_values,new_values,branch_code,database_actor) values('renewal_opportunities',o.id::text,'UPDATE',auth.uid(),jsonb_build_object('stage',o.stage),jsonb_build_object('stage',target),c.branch_code,session_user);
 return o.id;
end $$;

create view public.renewal_board_records with(security_invoker=true) as
 select c.*,coalesce(o.stage,'uncontacted') as stage,o.id as opportunity_id
 from public.client_certificate_records c left join public.renewal_opportunities o on o.certificate_id=c.id where c.is_active;
revoke all on public.renewal_board_records from public,anon,authenticated;grant select on public.renewal_board_records to authenticated;
create function public.pipeline_totals(b text,include_examples boolean default true) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not private.branch_access(b) then raise exception 'Cabang ditolak.' using errcode='42501';end if;
 select coalesce(jsonb_object_agg(stage,summary),'{}') into result from (
 select stage,jsonb_build_object('count',count(*),'amount',coalesce(sum(previous_order_value),0)::text,'examples',count(*) filter(where is_example)) summary
 from public.renewal_board_records where branch_code=b and (not is_example or include_examples) group by stage) totals;
 return result;
end $$;
revoke all on function public.pipeline_totals(text,boolean) from public,anon;grant execute on function public.pipeline_totals(text,boolean) to authenticated;
