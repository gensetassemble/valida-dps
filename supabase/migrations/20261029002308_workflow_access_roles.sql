-- Branch-scoped capabilities for explicitly requested development workflow roles.
insert into public.roles(code,name,description,is_active) values
 ('super_admin','Super Admin (IT Officer)','Administrasi aplikasi pada cabang yang ditugaskan; bukan superuser database.',true),
 ('tester','Tester (Baca Saja)','Meninjau data bisnis cabang tanpa hak tulis, impor atau pengelolaan akses.',true),
 ('department_head','Kepala Bidang','Baca seluruh data bisnis DPS sesuai keputusan pengguna; tanpa hak tulis.',true),
 ('unit_head','Kepala UP','Baca seluruh data bisnis DPS sesuai keputusan pengguna; tanpa hak tulis.',true)
on conflict(code) do nothing;
update public.roles set name='PTK / PJ Peralatan Kalibrasi',description='Penempatan Tenaga Kerja sebagai PJ peralatan dan kalibrasi dalam portofolio yang ditugaskan.' where code='equipment_manager';
create or replace function private.has_role(b text,wanted text[]) returns boolean language sql stable security definer set search_path='' as $$
 select private.actor_enabled() and exists(
 select 1 from public.user_role_assignments a
 join public.roles r on r.code=a.role_code and r.is_active
 join public.branches br on br.code=a.branch_code and br.is_active
 where a.profile_id=auth.uid() and a.branch_code=b and a.is_active and a.revoked_at is null
 and (a.role_code=any(wanted)
 or (a.role_code='super_admin' and 'admin'=any(wanted))
 or (a.role_code in ('tester','department_head','unit_head') and 'branch_head'=any(wanted))));
$$;
revoke all on function private.has_role(text,text[]) from public,anon;
grant execute on function private.has_role(text,text[]) to authenticated;
