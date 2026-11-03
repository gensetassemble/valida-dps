-- One request is the progress/audit/notification unit, even when it contains several tools.
-- Existing single-tool history is retained without backfilling or changing its snapshots.
alter table public.calibration_requests
 add column equipment_ids uuid[],
 add column items_snapshot jsonb not null default '[]'::jsonb,
 add column item_details jsonb not null default '{}'::jsonb,
 add column portfolio_code_snapshot text,
 add column supervisor_title text,
 add column signature_place text not null default 'Denpasar',
 add column certificate_name text not null default 'PT SUCOFINDO Cabang Denpasar',
 add column certificate_address text;
create index calibration_requests_equipment_ids on public.calibration_requests using gin(equipment_ids);

create or replace function private.calibration_supervisors(b text)
returns table(id uuid,full_name text,role_code text) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.has_role(b,array['admin','coordinator','equipment_manager']) then raise exception 'Akses pilihan pejabat ditolak.' using errcode='42501';end if;
 return query select distinct p.id,coalesce(d.full_name,p.full_name),a.role_code from public.profiles p
 join public.user_role_assignments a on a.profile_id=p.id and a.branch_code=b and a.role_code in ('department_head','unit_head')
 left join public.employee_directory d on d.id=p.employee_id and d.branch_code=b
 where private.target_has_role(p.id,b,a.role_code) and a.is_active and a.revoked_at is null
 and (d.id is null or (d.archived_at is null and d.merged_into_employee_id is null))
 and lower(trim(coalesce(d.full_name,p.full_name))) in ('taufik talentino','fikri haykal','putu angga bujana')
 order by 2,3;
end $$;

-- Definer is necessary to detect conflicts with requests hidden by RLS. Every selected tool
-- is independently authorized before any snapshot is read; this function is trigger-only.
create function private.prepare_uma_bundle() returns trigger language plpgsql security definer set search_path='' as $$
declare ids uuid[]; e public.equipment; p uuid; code text; n integer:=0; d date; prefix text; head text; detail jsonb; snapshots jsonb:='[]';
begin
 if auth.uid() is null then raise exception 'Akun aktif diperlukan.' using errcode='42501';end if;
 ids:=coalesce(new.equipment_ids,array[new.equipment_id]);
 if cardinality(ids) not between 1 and 50 or array_position(ids,null) is not null or cardinality(ids)<>(select count(distinct x) from unnest(ids) x) or not(new.equipment_id=any(ids)) then raise exception 'Pilih 1–50 alat unik dalam satu portofolio.';end if;
 -- Serialize submissions that overlap, including legacy single-tool submissions.
 perform 1 from public.equipment where id=any(ids) order by id for update;
 for e in select * from public.equipment where id=any(ids) order by id loop
  if e.branch_code<>new.branch_code or e.ownership<>'internal' or not e.is_active or not private.calibration_request_scope(new.branch_code,e.id,'requester') then raise exception 'Alat di luar cakupan Koordinator.' using errcode='42501';end if;
  if e.portfolio_id is null or (p is not null and p<>e.portfolio_id) then raise exception 'Satu pengajuan hanya untuk satu portofolio.';end if;
  p:=e.portfolio_id;n:=n+1;
  detail:=coalesce(new.item_details->e.id::text,'{}');
  if jsonb_typeof(detail)<>'object' or length(coalesce(detail->>'resolution_class',''))>200 or length(coalesce(detail->>'instrument_reading',''))>12000 then raise exception 'Rincian lampiran tidak valid.';end if;
  snapshots:=snapshots||jsonb_build_array(jsonb_build_object('id',e.id,'name',e.name,'tag',e.tag,'asset_id',e.asset_id,'serial',e.serial,'brand',e.brand,'model',e.model,'location',e.location,'measurement_range',e.measurement_range,'specification_size',e.specification_size,'color',e.color,'resolution_class',detail->>'resolution_class','instrument_reading',detail->>'instrument_reading'));
 end loop;
 if n<>cardinality(ids) then raise exception 'Sebagian alat tidak ditemukan.';end if;
 if exists(select 1 from public.calibration_requests r where r.status not in ('completed','cancelled') and (r.equipment_id=any(ids) or r.equipment_ids&&ids)) then raise exception 'Masih ada pengajuan aktif untuk salah satu alat.' using errcode='23505';end if;
 select portfolios.code into code from public.portfolios where id=p and branch_code=new.branch_code;
 if code is null then raise exception 'Portofolio tidak ditemukan.';end if;
 prefix:=split_part(trim(new.request_number),'/',1);
 if prefix!~'^[0-9]{1,4}$' then raise exception 'Isi nomor urut 1–4 digit. Format lengkap dibuat otomatis.';end if;
 d:=(now() at time zone 'Asia/Makassar')::date;
 new.request_number:=lpad(prefix,4,'0')||'/DPS-'||(array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'])[extract(month from d)::int]||'/OPS-'||code||'/'||extract(year from d)::text;
 new.unit_name:='Cab Denpasar / '||code;
 new.portfolio_code_snapshot:=code;new.equipment_ids:=ids;new.items_snapshot:=snapshots;new.quantity:=n;
 if jsonb_typeof(new.item_details)<>'object' then raise exception 'Rincian alat tidak valid.';end if;
 if new.supervisor_profile_id is not null then
  select s.full_name into head from private.calibration_supervisors(new.branch_code) s where s.id=new.supervisor_profile_id limit 1;
  if head is null then raise exception 'Pilih Taufik Talentino, Fikri Haykal atau Putu Angga Bujana yang aktif.' using errcode='42501';end if;
  new.supervisor_title:=case lower(trim(head)) when 'taufik talentino' then 'Kepala Bidang Inspeksi dan Pengujian' when 'fikri haykal' then 'Kepala Unit Pelayanan Lombok' when 'putu angga bujana' then 'Kepala Unit Pelayanan Benete' end;
 else new.supervisor_title:=null;
 end if;
 new.signature_place:=coalesce(nullif(trim(new.signature_place),''),'Denpasar');
 if length(new.signature_place)>100 or length(new.certificate_name)>250 or length(coalesce(new.certificate_address,''))>1000 then raise exception 'Isian tempat atau identitas sertifikat terlalu panjang.';end if;
 return new;
end $$;
revoke all on function private.prepare_uma_bundle() from public,anon,authenticated;
create trigger aa_prepare_uma_bundle before insert on public.calibration_requests for each row execute function private.prepare_uma_bundle();
