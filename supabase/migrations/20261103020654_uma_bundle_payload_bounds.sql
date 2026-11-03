create function private.check_uma_bundle_payload() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_typeof(new.item_details)<>'object' or octet_length(new.item_details::text)>750000 or exists(select 1 from jsonb_object_keys(new.item_details) k where not(k=any(coalesce(new.equipment_ids,array[new.equipment_id])::text[]))) then raise exception 'Rincian lampiran harus sesuai alat yang dipilih dan maksimal 750 KB.';end if;
 return new;
end $$;
revoke all on function private.check_uma_bundle_payload() from public,anon,authenticated;
create trigger a_check_uma_bundle_payload before insert on public.calibration_requests for each row execute function private.check_uma_bundle_payload();
