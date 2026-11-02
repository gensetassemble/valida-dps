# Pusat Notifikasi

Penyempurnaan halaman `/notifikasi` pada aplikasi VALIDA yang ada. Sidebar, navbar, akun, routing detail dan hak akses tetap memakai aplikasi yang sama. Setelah review lokal, pengguna menyetujui push dan deployment produksi pada 2 November 2026. Penanda rilis: `2026.11.02-notification-center.1`.

## Desain dan interaksi

- Kartu putih dengan border halus, radius 15px, ikon 42px, label kategori dan penanda unread kecil. Warna kategori: klien biru, personil ungu, alat teal, sistem slate. Status workflow memiliki badge tersendiri.
- Hierarki: kategori/status → judul singkat → nama pemilik/pelanggan → nomor/tag → perubahan nomor bila berbeda → waktu WITA. Nomor baru yang sama tidak diulang pada ringkasan; detail event tetap memuatnya.
- Public Sans untuk isi dan Space Grotesk untuk heading, dimuat sebagai font lokal dan diterapkan hanya di Pusat Notifikasi. Background halaman `#F4F6F1`; navigasi global tidak diganti.
- Filter kategori, status baca dan pencarian otomatis dengan debounce 300ms. Semua hitungan adalah jumlah sebenarnya dari inbox pengguna yang berhak diakses, bukan hitungan dari satu halaman. URL menyimpan filter.
- Pagination 25 aktivitas, dengan urutan stabil waktu dan ID. Kelompok tanggal memakai kalender WITA: Hari Ini, Kemarin, 7 Hari Terakhir (tujuh hari kalender termasuk hari ini), Lebih Lama.
- Aktivitas digabung hanya bila ID proses, kategori dan kelompok tanggal sama. Label menjelaskan jumlah aktivitas pada halaman tersebut; siklus lain atau sertifikat lain tidak digabung secara perkiraan. Event pada halaman selanjutnya tetap tersedia melalui pagination.
- Penandaan satu aktivitas, aktivitas dalam cluster, dan semua notifikasi tersedia. Tidak ada penandaan otomatis saat kartu tampil atau tautan dibuka. UI menampilkan error penyimpanan dan memuat ulang badge navbar/sidebar setelah berhasil.
- Detail yang tidak dapat diakses memiliki pesan yang jelas. Teks panjang membungkus, judul dibatasi dua baris, dan rincian/destinasi mempertahankan konten lengkap. Status proses tidak dihitung sebagai status masa berlaku.

## Data dan keamanan

Migrasi `20261102002101_notification_inbox_projection.sql` menambah view `notification_inbox_records` dengan `security_invoker=true` dan helper private SECURITY INVOKER. Helper memeriksa `auth.uid()` dan kepemilikan notifikasi, lalu membaca konteks domain memakai RLS sumber yang sama. Lookup domain dipisahkan agar kebijakan semua modul tidak diekspansi menjadi satu join yang berat. Tidak ada SECURITY DEFINER baru atau pelebaran cakupan cabang/portofolio.

View diperlukan agar pencarian nomor/nama/tag dan pagination dilakukan di server, tanpa mengunduh seluruh inbox ke browser. Kolom hasil berisi konteks yang spesifik: status event, nama, lisensi/alat, nomor, nomor baru, portofolio, ID proses, catatan dan tautan tujuan.

Server action read-state selalu memverifikasi pengguna, menyaring `profile_id=user.id`, hanya memperbarui `read_at` yang kosong, dan tetap tunduk pada RLS serta grant UPDATE(read_at). Aksi grup dibatasi 25 UUID. Aksi semua mencakup inbox yang benar-benar dapat diakses, termasuk notifikasi di luar halaman/filter yang sedang tampil.

Tidak ada perubahan logika email, penerima, jadwal reminder, ambang masa berlaku, atau eskalasi. Migrasi telah diterapkan pada Supabase development yang terhubung sebagai tambahan baca saja; aplikasi produksi lama tetap memakai view lama. Rekaman notifikasi dan status baca nyata tidak dihapus, direset, atau diubah dalam QA.

## Berkas

- `src/app/(dashboard)/notifikasi/{page,layout,loading,error}.tsx`: integrasi route, font dan state halaman.
- `src/features/notifications/inbox.tsx` dan `inbox.module.css`: inbox, filter, kartu, timeline, state baca, aksesibilitas dan responsivitas.
- `src/features/notifications/{model,server,actions}.ts`: model presentasi, grup tanggal, query/count, validasi tujuan dan penyimpanan read-state.
- `supabase/migrations/20261102002101_notification_inbox_projection.sql`: projection konteks tanpa migrasi data.
- `supabase/tests/notification_inbox.sql`, `tests/notification-inbox.test.ts`, `tests/notification-card.test.ts`: verifikasi keamanan dan presentasi.
- `src/types/database.ts`: tipe projection tambahan; `package.json`/lockfile: dua font lokal versi 5.3.0.
- `src/features/workflows/panels.tsx`: koreksi nama kolom lookup lisensi ke `certificate_type_name`, sesuai schema aktual; tidak mengubah gate.

## Verifikasi dan batasan

Vitest: 157 tes lolos. ESLint seluruh repository dan build produksi/TypeScript lolos. SQL regression menguji 133 aktivitas fixture, pagination 25, counts, pencarian, grouping yang mempertahankan event, metadata klien/alat/personil, penolakan helper untuk inbox lain, penolakan metadata alat di luar akses, serta mark-one/all dan persistensi read-state. Seluruh fixture di-rollback.

Browser: ukuran desktop 1440px dan ponsel 390px, pencarian/filter, rincian aktivitas, tujuan sertifikat dan empty state; unread akun nyata tetap sama. Screenshot sebelum/sesudah disimpan di `private-exports/notification-redesign-2026-11-02/` yang dikecualikan dari Git. Teks panjang dan nomor panjang, read/unread, escaping serta tujuan tidak aman diuji pada render komponen tanpa seed rekaman.

Batasan: cluster hanya menyatukan event yang sedang dimuat pada satu halaman dan satu kelompok tanggal; event lain tetap ada di halaman berikutnya. Inbox akun QA nyata saat pemeriksaan berisi kategori personil; kategori lainnya dan volume 100+ diverifikasi dengan fixture transaksi, bukan seed permanen. Tanggal kalibrasi tidak ditebak dari tanggal proses; tanggal ditampilkan hanya ketika konteks sumber tersedia. Pengiriman email tidak termasuk perubahan ini.
