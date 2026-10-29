# Database dan RBAC tahap 01–04

Sumber otoritatif adalah migrasi SQL berurutan; tipe database dihasilkan dari development aktual. Seluruh **27 tabel public** mempunyai RLS. Riwayat implementasi tahap 02 di bawah tetap menjadi fondasi; perluasan operasional dijelaskan pada bagian berikut dan [laporan tahap 03+04](phase34-report.md).

Pembaruan 29 Oktober 2026 menambahkan Super Admin (IT Officer), Tester, Kepala Bidang dan Kepala UP. IT Officer mewarisi administrasi hanya pada cabang yang ditugaskan; tiga peran lain mewarisi baca bisnis seluruh DPS sesuai arahan pengguna. PTK memakai hak PJ Peralatan/Kalibrasi yang sudah ada. [Rincian akun contoh dan verifikasi](development-accounts.md).

Instruksi selanjutnya mengimpor data operasional dan menghapus tahap Perlu Verifikasi dari tampilan bisnis. Status tanggal kini dihitung langsung; identitas/login dan RLS tetap terpisah. [Keadaan data, kebijakan terbaru dan hasil uji](operational-import-report.md) menggantikan uraian historis yang menyatakan seluruh sumber masih ditahan.

## Perluasan operasional tahap 03+04

| Entitas | Perilaku dan relasi tambahan |
|---|---|
| employee_directory | NPP tetap teks; kategori PT/PTT Regular/PTT Project/LS dan unit organisasi terpisah dari RBAC; header sumber lama dipertahankan |
| personnel_certificates | term/lifetime per lisensi; lifetime tanpa expiry/interval; judul/nama sumber, folder Drive dan baris impor; satu pegawai banyak lisensi |
| equipment + calibrations | Identitas aset terverifikasi dan banyak peristiwa historis; tanggal asli/manual/dihitung serta resolusi konflik; latest verified gagal/overdue mengalahkan clearance, latest pending tetap diperingatkan |
| import_batches → import_rows | Staging privat Admin cabang; file hash, koordinat/raw/normalized, isu, keputusan, reviewer dan canonical ID; idempoten/atomik, tanpa Auth otomatis |
| personnel_correction_requests | Pengajuan sendiri oleh Inspector, atau Admin/HRGA, tanpa perubahan lisensi resmi; Kepala Cabang tidak menulis |
| operational_documents | Parent domain/record terotorisasi, objek PDF privat; metadata/aktor diikat server/trigger; signed URL pendek |
| renewal_opportunities → renewal_events | Satu peluang per sertifikat klien, mengikuti akses client/AM saat ini; tahap hanya melalui gerbang RPC, histori append-only |

View operasional memakai security_invoker. Ringkasan dashboard/ekspor mengikuti baris yang dapat dibaca pemanggil. Helper internal privileged berada di schema private, search_path kosong, grant minimum dan pemeriksaan peran/identitas; wrapper public invoker. Label AM dibaca hanya untuk pelanggan yang sudah berhak diakses, tanpa membuka directory kepada AM.

Storage import-sources hanya Admin cabang. Aplikasi tidak dapat menghapus sumber nyata; penghapusan objek hanya batch sintetis yang secara eksplisit ditandai operator database. Storage certificate-documents memerlukan metadata dengan parent yang dapat diakses; policy restrictive tetap menolak objek yatim. Tidak ada bucket publik.

Semua impor kanonis menghasilkan pending; approval staging bukan verifikasi sertifikat. Flag contoh dan source_import_row_id tidak dapat dipalsukan lewat payload biasa. Contoh klien diwariskan ke sertifikat dan dikecualikan peluang riil. Tiga batch nyata saat ini berisi 299 baris pending; 13 normalized NPP dikoreksi dengan izin pengguna, raw tetap utuh. Master 39 belum dipromosikan sesuai instruksi pengguna.

## Relasi

| Kelompok | Tabel dan hubungan |
|---|---|
| Organisasi | branches(code) → work_areas dan portfolios; portfolio_aliases → portfolios |
| Directory | employee_directory terpisah dari Auth, NPP teks opsional unik per cabang; status kepegawaian/verifikasi/aktif terpisah |
| Identitas | auth.users(id) → profiles(id); employee_id unik → employee_directory pada cabang sama |
| Role | user_role_assignments → profiles/roles, unik profile-role-cabang; alasan dan aktor/waktu grant/revoke |
| Portofolio pegawai | employee_portfolio_assignments → employee/portfolio, jenis, masa efektif dan verifikasi |
| Katalog | certificate_types kategori client/personnel/equipment; service_types; service_competency_requirements menghubungkan layanan/jenis personil dengan dasar persyaratan |
| Pelanggan | clients → wilayah/portofolio/AM; client_contacts → clients; client_assignment_history append-only |
| Sertifikat klien | client_certificates → client/type/inspector/portfolio; tetap terkait client sama saat AM dialihkan |
| Kompetensi | personnel_certificates → employee/type; personnel_certificate_services → sertifikat/layanan |
| Peralatan | equipment kepemilikan internal/client, portfolio dan penanggung jawab; calibrations → equipment |
| Audit | audit_logs: tabel/id, old/new JSON, aktor Auth/database, waktu/cabang; ledger aktivasi lama tetap private |

FK gabungan (id,branch_code) menolak relasi lintas cabang. Nominal numeric(20,2); NPP, nomor sertifikat, serial dan referensi order/kontrak tetap teks. Tanggal bisnis date, audit timestamptz ditampilkan WITA. Kalibrasi menyimpan dasar/sumber due date; interval belum diverifikasi tidak otomatis dianggap bukti sertifikat.

Directory pegawai tidak otomatis membuat akun. Satu orang tidak digandakan untuk tiap role/portofolio.

## Matriks bisnis

Hak memerlukan profil, pegawai, role dan cabang aktif. Portofolio berarti penugasan terverifikasi yang masih efektif. Beberapa role memberikan gabungan hak pada cabang masing-masing.

| Role | Pelanggan/kontak/sertifikat klien | Directory/kompetensi | Alat/kalibrasi | Pengguna/role/audit |
|---|---|---|---|---|
| Admin | Baca/tulis cabang grant | Baca/tulis cabang grant | Baca/tulis cabang grant | Kelola orang lain, baca audit cabang |
| Account Manager | Baca/tulis pelanggan yang ditugaskan; owner/cabang tetap | Tidak ada | Tidak ada | Baca profil/grant sendiri |
| HRGA | Tidak ada | Baca/tulis personil cabang, penugasan personnel | Tidak ada | Baca profil/grant sendiri |
| Koordinator | Tidak ada | Baca personil portofolio; tidak menyetujui kompetensi resmi | Baca portofolio | Baca profil/grant sendiri |
| QSHE | Baca portofolio | Baca portofolio | Baca portofolio | Baca profil/grant sendiri |
| PJ Peralatan | Tidak ada | Tidak ada hak directory bisnis | Baca/tulis portofolio; pengalihan aset oleh Admin | Baca profil/grant sendiri |
| Personil/Inspector | Tidak ada | Baca sendiri | Tidak ada | Baca profil/grant sendiri |
| Kepala Cabang | Baca bisnis cabang | Baca bisnis cabang | Baca bisnis cabang | Baca profil/grant sendiri; tanpa pengelolaan/audit |
| Anon/nonaktif | Tidak ada | Tidak ada | Tidak ada | Tidak ada data organisasi |

Katalog organisasi dibaca role aktif dalam cabang yang diberikan, ditulis Admin. Role adalah definisi sistem tetap. Cabang baru memerlukan provisioning organisasi. Member tahap 01 dinonaktifkan.

Matriks menggambarkan RLS domain yang sudah diterapkan. UI tahap 02 hanya master/kontak/profil/peran/audit; UI operasi sertifikat/kompetensi/alat penuh menunggu Prompt 03.

## Aturan mutation

- Admin hanya cabang eksplisit dan tidak dapat self-grant atau menaikkan akses dengan perubahan profil sendiri.
- Aktivasi profile memerlukan pegawai aktif, employment_status active, verification_status verified dan email cocok dengan UUID Auth yang sudah disediakan.
- Trigger menetapkan/mempertahankan aktor dan waktu created/updated, verification serta grant/revoke; client tidak dapat memalsukannya.
- Penugasan coordinator/qshe/equipment_responsible khusus Admin; HRGA hanya personnel, sehingga tidak membuka scope monitoring sendiri.
- Identitas/cabang/parent tidak dapat dipindah melalui update biasa. Kategori type yang sudah direferensikan tidak dapat diubah.
- Pengalihan AM hanya Admin dengan alasan; client ID dan sertifikat tetap sama. Riwayat menyimpan AM lama/baru, waktu, alasan dan aktor.
- Nonaktifnya profil/directory/role/cabang atau revoke grant menutup akses tanpa menunggu JWT diperbarui.
- Authenticated tidak mendapat DELETE; audit/history tidak memiliki operasi tulis aplikasi.

## Lapisan keamanan

Guard getUser dan penugasan database diperiksa server; setiap Server Action mengulangi autentikasi/otorisasi. Registry server-owned dan Zod strict menolak injection field/branch/actor/tabel. Tabel/lookup memakai client cookie pengguna tanpa service-role key; lookup maksimum 20 pilihan, query tabel maksimum 20 baris.

Helper SECURITY DEFINER terbatas pada lookup internal actor/scope untuk menghindari rekursi RLS, di private dengan search_path kosong dan auth.uid() check. PUBLIC/anon serta internal helper dicabut execute-nya. Tidak ada RPC privileged public. Precheck SECURITY INVOKER menolak mutation tak berwenang sebelum trigger privileged memeriksa UUID/email.

UPDATE policy memiliki USING/WITH CHECK. auth.uid() independen baris dibungkus SELECT untuk initplan, scope berkorelasi tetap memakai argumen branch/record. Indeks mencakup FK/jalur scope; tidak ada view privileged public.

Bucket certificate-documents tetap private dengan restrictive deny anon/authenticated. Hak metadata bukan hak dokumen; signed URL belum tersedia.

## Bootstrap dan pengujian

Administrator organisasi menyediakan Auth user resmi, pegawai terverifikasi, profile dan grant Admin pertama melalui operasi database privileged yang ditinjau. Bootstrap tidak diekspos ke aplikasi; gunakan UI Admin untuk akun berikutnya. Jangan memberi role dari user_metadata atau otomatis dari impor directory.

supabase/tests/phase02_rls.sql memakai UUID sintetis dalam transaksi, menyetel identitas PostgreSQL, menjalankan assertion positif/negatif, lalu rollback. Suite sudah diuji di development melalui konektor. Jalankan npm run db:test bila Docker tersedia; reset/lint lokal belum diuji di komputer ini.

Seed bisnis produksi harus berasal dari sumber organisasi yang ditinjau. Tiga CONTOH certificate_types bukan regulasi. Jangan menyimpan pegawai/pelanggan, spreadsheet sumber atau sertifikat privat di Git/public assets.
