# Mode Simulasi pada website utama

Akun yang disediakan: `tester@tester.com`. Password dan profil login tetap sama.

1. Login ke https://valida-dps.vercel.app.
2. Klik **Mode Simulasi** di kanan bawah.
3. Selesaikan MFA bila diminta. Ini melindungi akses administrator pada ruang latihan.
4. Pastikan banner **MODE SIMULASI** tampil dan cabang adalah **SIMDPS**.
5. Gunakan data `[LATIHAN]` untuk mencoba pengelolaan alat, kompetensi, sertifikat klien, pengajuan, dan master data.
6. Klik **Keluar simulasi** untuk kembali membaca data DPS.

Data latihan disimpan terpisah menurut cabang SIMDPS. Perubahan tidak direset otomatis ketika keluar mode. Data operasional DPS tetap hanya baca bagi akun ini, termasuk jika endpoint dipanggil langsung.

Pembuatan profil, perubahan password profil, penugasan peran, dan impor akun dalam mode ini memakai identitas simulasi. Tidak ada akun Auth atau hak akses nyata yang dibuat. Pengaturan cabang dan perubahan password akun sendiri hanya memvalidasi simulasi; tidak mengubah konfigurasi/login asli. Logout dan MFA tetap memakai layanan autentikasi sebenarnya.

Email sungguhan tidak dikirim. Tautan Outlook/mailto pada mode ini dihentikan dengan pemberitahuan simulasi. Antrean/delivery email SIMDPS ditolak di database. Bila modul email baru dipasang setelah migrasi ini, pastikan trigger `aa_simulation_no_email` juga dipasang pada tabel antrean baru sebelum mengaktifkan pengiriman.

Admin utama tetap mengelola akun/peran asli dari DPS. Pengguna simulasi tidak dapat mengubah tabel identitas atau penugasan akses asli. Profil latihan memakai tabel `simulation_profiles` dan `simulation_role_assignments`, bukan `profiles` atau `user_role_assignments`.

Validasi: tes scope aplikasi, pemetaan tabel, penyimpanan profil tanpa Auth, logout, serta tes database rollback untuk penolakan tulis data operasional, pemberian akses nyata, dan email.
