# VALIDA — Validity Alert & Data Archive

Aplikasi internal PT SUCOFINDO Cabang Denpasar (DPS), wilayah Bali, NTB dan NTT. Bahasa Indonesia; zona bisnis Asia/Makassar (WITA).

**Tahap 01–04 diimplementasikan di development:** database/RBAC, UI PRISMA, master data, tiga modul operasional, impor CSV/XLSX dengan staging/review, dashboard dan ekspor. Pipeline perpanjangan ditambahkan sesuai permintaan pengguna. Istilah pegawai di antarmuka adalah **NPP**; header NRK sumber tetap dipertahankan sebagai provenance.

**Keadaan sumber terbaru:** 54 lisensi, 173 record alat dan 181 peristiwa kalibrasi sudah diimpor sesuai instruksi pengguna. Sebanyak 206 baris kalibrasi tetap terlacak; 25 observasi identik tidak digandakan. Master 39 tetap di staging. Sepuluh sertifikat `[CONTOH]` tersedia; nilainya dikecualikan dari peluang riil. [Laporan impor terbaru](docs/operational-import-report.md).

**Tidak ada tahap Perlu Verifikasi pada modul operasional.** Masa berlaku langsung dihitung dari tanggal sumber. Tanggal/hasil kalibrasi kosong diberi label data belum diisi, tanpa mengarang hasil Layak. Metadata historis dan keamanan akun tetap terpisah. Pipeline H−90/kedaluwarsa memakai papan ringkas tanpa gulir horizontal, satu kartu prioritas dan halaman per tahap.

**Pembaruan akun development, 29 Oktober 2026:** pengguna meminta sepuluh akun contoh yang dipertahankan: Tester, Super Admin/IT Officer, QSHE, HRGA, Koordinator, AM, PTK, Kepala Bidang, Kepala UP, Kepala Cabang. [Cakupan dan verifikasi akun](docs/development-accounts.md). Kredensial hanya di berkas lokal privat `private-exports/akun-development.md`, tidak masuk Git. Akun resmi organisasi tetap terpisah dari akun contoh ini.

[Laporan tahap 03+04 dan hasil uji](docs/phase34-report.md) · [Skema dan matriks akses](docs/database-rbac.md) · [Riwayat tahap 02](docs/phase02-report.md) · [Riwayat tahap 01](docs/setup-report.md)

## Status aktual

- Next.js 16.4.3, React 19.3.1, TypeScript 5.9.3, Tailwind 4.3.3; dependency langsung dipin dan lockfile disimpan.
- Node 24 LTS (teruji 24.22.1), npm 11–12 (teruji 12.2.1).
- Supabase JS 2.118.0, SSR 0.12.7, CLI 2.122.0.
- Development: `valida-dps-dev`, ref `vzxmnkmvcbzxrkzdtxuy`, Free, Singapore; [dashboard](https://supabase.com/dashboard/project/vzxmnkmvcbzxrkzdtxuy).
- 27 tabel public dengan RLS; sepuluh migrasi tambahan tahap 03+04 diterapkan. Nomor lokal sesuai riwayat server.
- Fixture sementara tahap 03+04 sudah dibersihkan. Sepuluh akun contoh workflow kemudian dibuat atas permintaan pengguna dan dipertahankan; sepuluh sertifikat klien fiktif tersedia terpisah dari data sumber perusahaan.
- Tidak ada proyek produksi, push GitHub atau deployment Vercel yang diklaim; tidak ada peningkatan paket berbayar.

## Menjalankan aplikasi

```powershell
npm ci
Copy-Item .env.example .env.local
# Isi URL dan publishable key Supabase development yang disetujui.
npm run dev
```

Buka [localhost:3000](http://localhost:3000). Root mengarah ke dashboard dan login bila belum terautentikasi. Tidak ada signup publik. Gunakan akun organisasi yang sudah disediakan; directory pegawai tidak otomatis membuat akun Auth.

Di komputer ini npm belum berada di PATH. Bentuk setara: `node .tools/package/bin/npm-cli.js run dev`. Direktori .tools diabaikan Git; untuk clone baru pasang Node/npm resmi.

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

## Halaman aplikasi

| Route | Fungsi |
|---|---|
| /login, /reset-password, /update-password | Supabase Auth, validasi, show/hide; recovery nyata memerlukan konfigurasi email |
| /dashboard | Ringkasan Supabase sesuai RLS, status WITA, 90 hari, lifetime terpisah, drill-down dan peluang riil |
| /sertifikat-klien | CRUD, detail/riwayat, 14 kolom kerangka pengguna, filter dan ekspor XLSX |
| /kompetensi-personil | CRUD lisensi per pegawai, lifetime, koreksi dan referensi folder Drive |
| /kompetensi-personil/matriks | Satu pegawai banyak lisensi/portofolio, status tanggal langsung dan lifetime terpisah |
| /kalibrasi-alat | CRUD aset, histori kalibrasi, tambah peristiwa, status kelayakan |
| /peristiwa-kalibrasi/[id] | Detail/ubah satu peristiwa tanpa menimpa riwayat sebelumnya |
| /impor-data | Admin: template, upload privat, mapping, preview, review baris dan commit terkontrol |
| /pipeline-perpanjangan | Kanban enam tahap untuk AM, gerbang PIC/PDF penawaran/PO, catatan dan histori |
| /master-data | Ikhtisar sesuai role/cabang |
| /master-data/cabang | Lihat/ubah cabang yang diberikan; cabang baru melalui provisioning organisasi |
| /master-data/wilayah | Wilayah kerja |
| /master-data/portofolio | Portofolio, detail alias historis dan verifikasi |
| /master-data/pegawai | Directory, NPP teks, status kepegawaian/verifikasi; detail penugasan portofolio |
| /master-data/jenis-sertifikat | Kategori, penerbit, rujukan, interval/hari pengingat; detail persyaratan layanan |
| /master-data/layanan | Katalog layanan |
| /pelanggan | Pelanggan/AM/wilayah/portofolio, detail kontak |
| /pengaturan/pengguna | Tautkan UUID Auth yang sudah ada, aktivasi, multi-role oleh Admin |
| /pengaturan/roles | Katalog peran tetap dan grant/revoke per cabang |
| /profil, /audit | Profil/peran sendiri; audit cabang khusus Admin |

Pencarian, filter kolom/status, chip/hapus filter, sort stabil dan pagination 20 baris dilakukan di server sesuai RLS. Form React Hook Form + Zod divalidasi kembali pada Server Action. Keberhasilan simpan hanya ditampilkan setelah database mengembalikan rekaman. Ada detail, konfirmasi perubahan akses/status dan aksi massal pada entitas yang sesuai. UI memakai aktif/nonaktif tanpa penghapusan fisik.

## Identitas, RBAC dan keamanan

Auth user ditautkan ke profile dan directory pegawai. Satu akun dapat mempunyai banyak role per cabang, satu pegawai banyak portofolio. Hak berasal dari penugasan database aktif, bukan user_metadata atau profiles.role_code lama. Profil aktif memerlukan pegawai aktif/terverifikasi; scope pemantauan memerlukan penugasan portofolio terverifikasi yang masih berlaku.

Admin hanya mengelola cabang yang diberikan dan tidak dapat menaikkan role sendiri. AM hanya pelanggan miliknya; pengalihan oleh Admin menyimpan alasan/riwayat dan mempertahankan relasi sertifikat. HRGA mengelola personil; penugasan yang membuka scope monitoring khusus Admin. Kepala Cabang membaca bisnis tanpa hak tulis. Lihat [matriks lengkap](docs/database-rbac.md).

Guard server, otorisasi setiap Server Action, grant eksplisit dan RLS melindungi akses berlapis. Anon tidak membaca organisasi; authenticated tidak mempunyai DELETE; audit/history tidak dapat ditulis aplikasi. Helper privileged di schema private memakai search_path kosong dan execute minimum. Trigger menjaga aktor/waktu, parent, branch dan identitas. Revoke berlaku dari database tanpa menunggu JWT baru.

Client memakai publishable key dan cookie SSR per request; tidak membutuhkan service-role/secret key. logging.serverFunctions=false mencegah argumen login dicatat oleh development Next.js.

## UI

Pola [PRISMA](https://github.com/spatiallity/prisma) diimplementasikan ulang: sidebar putih 240/68 px, topbar sticky 56 px, breadcrumb, drawer mobile, profil/logout, kartu putih border slate 2 px, tabel/form ringkas. Tidak menyalin data, logo atau kode sumber secara verbatim.

Token di src/app/globals.css: navy #0B2545, hijau #1F9D6B, hover #16845A, canvas #F1F5F9, border #E2E8F0. Plus Jakarta Sans disajikan lokal lewat Fontsource; tombol hijau memakai teks navy untuk kontras. Angka tabular, rupiah dengan presisi desimal, tanggal bisnis dan audit WITA. Dialog Radix menyediakan focus trap, Escape dan pemulihan fokus; focus ring/reduced motion tersedia.

## Struktur sumber

```text
src/app/                   Routes, Server Components, API, Server Actions
src/components/app-shell/  Shell/sidebar/topbar/breadcrumb
src/components/ui/         Komponen bersama, DataTable, dialog, toast
src/features/master-data/  Registry allowlist, validasi, query, aksi, form
src/features/operations/   CRUD, matriks, kompetensi, dokumen dan filter
src/features/imports/      Parser privat, normalisasi, review, commit
src/lib/domain/            Tanggal WITA, lifetime dan kelayakan
src/lib/http/              Batas request streaming sebelum parsing
src/lib/auth/              Guard dan permission cabang
src/lib/supabase/          Client SSR/browser dan Storage tertutup
src/lib/microsoft/         Kontrak Microsoft 365 belum aktif
src/types/database.ts      Tipe hasil generasi database aktual
supabase/migrations/       Skema, katalog, RLS, constraint, trigger, indeks
supabase/tests/            Suite SQL transaksi/rollback
tests/                     Unit/security dan browser tests
docs/                      Skema, laporan, integrasi, deployment
```

## Environment dan integrasi

Salin nama variabel dari .env.example; .env.local tidak boleh masuk Git. APP_URL adalah origin callback tepercaya. NEXT_PUBLIC_SUPABASE_URL/PUBLISHABLE_KEY boleh di browser; secret Microsoft, CRON_SECRET dan kunci privileged harus server-only. Flag email tetap false.

Bucket certificate-documents privat, PDF maksimum 10 MiB, akses mengikuti parent/RLS dan signed URL 60 detik. Dokumen yatim/tidak sah ditolak. Belum ada PDF bisnis nyata yang diberikan; uji positif SQL hanya metadata sintetis dan browser menguji penolakan berkas tidak valid. Bucket import-sources privat, 5 MiB/2.500 baris per CSV/XLSX. Tidak ada kunci privileged pada aplikasi.

[Microsoft 365](docs/microsoft-365.md) menunggu Entra tenant/app, consent organisasi, mailbox dan penyimpanan token. [GitHub/Vercel](docs/deployment.md) menunggu hak publikasi serta hosting perusahaan yang sesuai. Tidak ada email dikirim atau cron diaktifkan. Menu tahap berikutnya berlabel “Nanti”.

## Pengujian dan database lokal

```powershell
npx supabase --version
npm run db:start
npm run db:lint
npm run db:test
npm run db:types
npm run check:connections
npx playwright install chromium
npm run test:e2e
```

Docker/Podman tidak tersedia sehingga startup/lint/reset database lokal belum terverifikasi. Suite pgTAP dijalankan pada development melalui konektor dan rollback seluruh fixture. CLI belum login/link; sesi konektor tidak otomatis memberi sesi CLI. Setelah login resmi gunakan supabase link --project-ref vzxmnkmvcbzxrkzdtxuy, lalu periksa migration list. Jangan menerapkan ulang migrasi tercatat.

Windows dapat memakai $env:PLAYWRIGHT_CHANNEL='msedge'. Empat browser tests anonim berjalan tanpa akun. Enam belas authenticated tests memerlukan fixture development terotorisasi terpisah dan dilewati bila .tools/phase02-identities.json tidak ada. Tidak ada pembuatan akun otomatis pada CI. Hasil tahap 03+04: **51 unit/security dan 20 browser lulus**, suite SQL RLS operasional lulus, lint/typecheck/build lulus, audit dependency produksi 0 vulnerabilities. Percobaan ulang akhir suite SQL tahap 02 terkendala konektor; sembilan browser regresi tahap 02 lulus. CI cloud belum dijalankan. Rincian/batas verifikasi ada di laporan tahap 03+04.

## Alur impor privat

1. Admin memilih cabang dan domain, mengunduh template, lalu mengunggah CSV/XLSX. Template klien memakai tepat 14 header kerangka pengguna. Referensi pelanggan/katalog/AM harus ditinjau, tidak dibuat otomatis dari teks.
2. Biner upload masuk bucket privat; preview menyimpan hash, koordinat, raw values, normalized values dan isu. File/hash berulang mengembalikan batch yang sama tanpa menimpa review. Untuk workbook, Data dipakai bila tersedia; workbook master saat ini hanya mengambil PT & PTT Reguler.
3. Reviewer memeriksa setiap identitas, NPP teks, katalog, aset, tanggal dan relasi. SIAP_TINJAU tidak sama dengan approval. Koreksi normalized menyimpan provenance/audit, sementara raw values tetap.
4. Commit hanya baris yang sudah disetujui, dengan konfirmasi IMPOR DPS DEVELOPMENT dan target development yang disetujui. Seluruh batch atomik/idempoten. Impor tidak mengaktifkan pegawai, mengesahkan dokumen atau membuat Auth.

Sumber sesi ini: master 39 (24 PT, 15 PTT Regular), kompetensi 54 (50 berjangka, empat lifetime), kalibrasi 206. Sesuai instruksi terbaru, 54 lisensi dan 206 observasi kalibrasi sudah ditautkan ke record operasional; 25 observasi identik tidak menggandakan peristiwa. Master 39 tetap pending. Tiga pemetaan NPP pada 13 baris cocok dengan referensi pegawai hasil impor. Empat biner sumber telah diarsipkan privat dan diverifikasi hash-nya. Tidak ada sumber/data privat di Git atau bundel frontend.

Lifetime tanpa expiry/interval dikecualikan dari bucket waktu. Tidak ada tahap review pada tampilan operasional: masa berlaku mengikuti tanggal sumber. Barang Baik/Terpakai bukan hasil kalibrasi layak; hasil/tanggal kosong ditampilkan sebagai data belum diisi. Peristiwa gagal/kedaluwarsa tidak memberi clearance aman. Nilai peluang dashboard mengecualikan contoh dan menampilkan Belum ada data jika tidak ada sertifikat klien riil. Folder Drive mengikuti izin Google Drive.

## Berikutnya

Organisasi perlu menyediakan akun Auth resmi dan bootstrap Admin pertama melalui administrator database berwenang, dengan pegawai terverifikasi/grant cabang eksplisit. Sesudahnya Admin mengelola profil/grant lain dari UI. Katalog CONTOH jenis sertifikat perlu ditinjau sebelum menjadi referensi resmi; tidak ada regulasi/identitas pegawai yang dikarang.

Leaked-password protection belum aktif dan sempat memunculkan WARN ketika akun uji tersedia; fitur memerlukan [Supabase Pro atau lebih tinggi](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Sesudah cleanup, security advisor hanya memuat INFO ledger audit private tanpa policy, yang sengaja menolak client. Paket tetap Free sesuai arahan pengguna; unused indexes pada database kosong bukan benchmark produksi.

Verifikasi terbaru: 57 unit test, suite SQL RLS operasional dan suite antrean H−90 lulus; tujuh role diperiksa melalui API dan desktop/seluler diperiksa di browser. Tahap berikutnya: melengkapi lima lisensi yang belum dipetakan portofolionya, hasil/tanggal alat yang kosong, dokumen yang benar-benar diberikan, akun organisasi, serta Microsoft 365/pengingat. Laporan QSHE/eksekutif penuh tetap tahap lanjutan.
