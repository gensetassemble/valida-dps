# Akun contoh untuk pengujian workflow

29 Oktober 2026, WITA. Pengguna meminta sepuluh akun contoh development, lalu mengonfirmasi domain `.invalid`, arti PTK, dan akses baca seluruh DPS untuk Kepala Bidang/Kepala UP. Akun ini dipertahankan untuk digunakan pengguna; bukan enam fixture sementara tahap 03+04 yang sudah dihapus.

| Akun/peran | Hak efektif |
|---|---|
| Tester | Baca bisnis DPS; tidak menulis, membaca staging, atau mengelola akses |
| Super Admin (IT Officer) | Administrasi aplikasi pada cabang DPS yang diberikan secara eksplisit; bukan database superuser atau akses lintas cabang otomatis |
| QSHE | Pemantauan portofolio contoh yang ditugaskan |
| HRGA | Directory dan kompetensi DPS, termasuk verifikasi oleh role berwenang |
| Koordinator Operasional | Pemantauan kompetensi/alat pada portofolio contoh; tidak mengesahkan lisensi HRGA |
| Account Manager | Enam pelanggan contoh beserta sertifikat dan pipeline-nya |
| PTK / PJ Peralatan Kalibrasi | Penempatan Tenaga Kerja, sebagai PJ alat/kalibrasi dalam portofolio contoh |
| Kepala Bidang | Baca seluruh bisnis DPS, sesuai pilihan pengguna |
| Kepala UP | Baca seluruh bisnis DPS, sesuai pilihan pengguna |
| Kepala Cabang | Baca seluruh bisnis DPS |

Role `super_admin` mewarisi kemampuan `admin`; `tester`, `department_head`, dan `unit_head` mewarisi kemampuan baca `branch_head`. Pemetaan dipakai konsisten pada TypeScript dan helper RLS; batas cabang, akun aktif, status role, pencabutan, dan larangan grant diri sendiri tetap berlaku. Aktivasi identitas pegawai bukan syarat login pada matriks terbaru. Penugasan dari `user_metadata` tidak digunakan. Role lama tetap tersedia.

Migrasi aditif: `20261029002308_workflow_access_roles.sql`. PTK tetap memakai kode `equipment_manager` agar penugasan dan kebijakan yang ada kompatibel. Pilihan form role menggunakan katalog allowlist yang sama dengan guard aplikasi.

Sepuluh directory sintetis berlabel `[CONTOH]`, dengan NPP `NULL`, mendukung relasi profile yang diwajibkan aplikasi. Status verifikasi sintetis hanya untuk menjalankan sandbox, bukan klaim identitas pegawai. Master 39 dan seluruh 299 baris perusahaan tetap pending di staging; tidak dipromosikan atau dipakai membuat akun.

Portofolio `CONTOH_WORKFLOW` terpisah dari portofolio operasional: QSHE, Koordinator dan PTK masing-masing mendapat assignment sesuai perannya. Enam pelanggan dummy ditautkan ke AM development dan portofolio contoh tersebut, dengan riwayat pengalihan. Tidak membuat contoh PDF atau bukti kontak/pengiriman.

Email dikonfirmasi hanya untuk akun `.invalid` sintetis yang diminta; tidak ada undangan atau email keluar. Signup publik tetap ditutup. Kredensial acak berbeda per akun, disimpan hanya pada `private-exports/akun-development.md` dan manifest lokal `.tools/`; kedua direktori diabaikan Git. Jangan menambahkan password, hash, UUID akun provisioned atau SQL berisi kredensial ke migrasi/seed publik.

## Verifikasi

- Login Supabase untuk **10/10** akun, profile aktif dan role sesuai: lulus.
- Uji memakai publishable key dan RLS aktual: IT Officer melihat tiga batch sumber; sembilan akun lain tidak melihat staging. Enam contoh terlihat hanya bagi role yang mempunyai akses client. Empat akun baca tidak dapat memperbarui pelanggan: lulus.
- `supabase/tests/workflow_roles_rls.sql` dijalankan pada development, seluruh fixture rollback: lulus. Mencakup administrasi IT Officer, penolakan lintas cabang/grant diri, Tester/tiga jabatan kepala tanpa hak tulis atau eskalasi, dan PTK menulis kalibrasi hanya di portofolionya.
- `npm test`: **56/56** lulus; lint, typecheck dan build lulus.
- Login browser localhost untuk Tester berhasil; daftar sertifikat menampilkan enam contoh tanpa tombol perubahan. Filter AM menampilkan AM development, bukan Tester. Verifikasi browser IT Officer tidak diklaim selesai karena tab sedang digunakan untuk penjelajahan; login dan kewenangannya telah lulus uji API serta SQL RLS.

Filter AM kini mengambil nama dari sertifikat pelanggan yang sudah dapat diakses, bukan dari daftar profile yang dapat terbatas hanya pada diri pemanggil. Karena itu Tester/Kepala tidak ditampilkan sebagai AM hanya karena sedang login; tidak membuka akses directory/profil lain.

Security advisor tetap mengingatkan leaked-password protection yang belum aktif pada paket Free ([panduan resmi](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)); paket tidak ditingkatkan. Ledger private tanpa policy tetap disengaja menolak client. Tidak ada deployment produksi, email atau cron dalam pekerjaan ini.
