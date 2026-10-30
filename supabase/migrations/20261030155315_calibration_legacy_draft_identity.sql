-- Read-only fallback for drafts saved before requester identity snapshots existed.
create function private.calibration_form_identity(r uuid)
returns table(requester_employee_id uuid,requester_npp text)
language plpgsql stable security definer set search_path='' as $$
declare request public.calibration_requests;
begin
 select * into request from public.calibration_requests where id=r;
 if auth.uid() is null or request.id is null or not private.calibration_request_scope(request.branch_code,request.equipment_id,'read') then raise exception 'Formulir tidak dapat diakses.' using errcode='42501';end if;
 if request.requester_employee_id is not null then
  return query select request.requester_employee_id,request.requester_npp;
 else
  return query select d.id,d.npp from public.profiles p
   join public.employee_directory d on d.id=p.employee_id and d.branch_code=request.branch_code
   where p.id=request.created_by and d.archived_at is null and d.merged_into_employee_id is null;
  if not found then return query select null::uuid,null::text;end if;
 end if;
end $$;
revoke all on function private.calibration_form_identity(uuid) from public,anon,authenticated;
grant execute on function private.calibration_form_identity(uuid) to authenticated;
create function public.calibration_request_form_identity(r uuid)
returns table(requester_employee_id uuid,requester_npp text)
language sql stable security invoker set search_path='' as $$select * from private.calibration_form_identity(r);$$;
revoke all on function public.calibration_request_form_identity(uuid) from public,anon,authenticated;
grant execute on function public.calibration_request_form_identity(uuid) to authenticated;
