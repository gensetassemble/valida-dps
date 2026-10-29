create or replace function public.validity_status(d date,v text,kind text default 'term') returns text language sql stable set search_path='' as $$
 select case when kind='lifetime' then 'Berlaku Seumur Hidup' when d is null then 'Tanggal Belum Diisi'
 when d<(now() at time zone 'Asia/Makassar')::date then 'Expired' when d<=(now() at time zone 'Asia/Makassar')::date+30 then 'Kritis'
 when d<=(now() at time zone 'Asia/Makassar')::date+60 then 'Perhatian' when d<=(now() at time zone 'Asia/Makassar')::date+90 then 'Pantau' else 'Aman' end;
$$;
