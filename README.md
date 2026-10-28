# VALIDA — Validity Alert & Data Archive

Aplikasi internal PT SUCOFINDO Cabang Denpasar (DPS), wilayah Bali, NTB dan NTT. Bahasa Indonesia; zona bisnis Asia/Makassar (WITA).

**Prompt 02 sudah diimplementasikan dan diuji di development:** database/RBAC, UI PRISMA dan CRUD master data. UI operasional sertifikat klien, kompetensi personil dan kalibrasi merupakan Prompt 03. Belum ada import, email, cron, PDF, laporan atau KPI operasional buatan.

[Laporan implementasi dan hasil uji](docs/phase02-report.md) · [Skema dan matriks akses](docs/database-rbac.md) · [Riwayat tahap 01](docs/setup-report.md)

## Status aktual

- Next.js 16.4.3, React 19.3.1, TypeScript 5.9.3, Tailwind 4.3.3; dependency langsung dipin dan lockfile disimpan.
- Node 24 LTS (teruji 24.22.1), npm 11–12 (teruji 12.2.1).
- Supabase JS 2.118.0, SSR 0.12.7, CLI 2.122.0.
- Development: `valida-dps-dev`, ref `vzxmnkmvcbzxrkzdtxuy`, Free, Singapore; [dashboard](https://supabase.com/dashboard/project/vzxmnkmvcbzxrkzdtxuy).
- 21 tabel public dengan RLS; delapan migrasi tahap 02 diterapkan. Nomor lokal sesuai riwayat server.
- Enam akun sementara berlabel CONTOH dibuat dengan izin pengguna untuk browser tests, lalu akun/sesi dan seluruh data contoh terkait dihapus. Tidak ada akun demo permanen.
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

## Halaman tahap 02

| Route | Fungsi |
|---|---|
| /login, /reset-password, /update-password | Supabase Auth, validasi, show/hide; recovery nyata memerlukan konfigurasi email |
| /dashboard | Fondasi dashboard tanpa KPI palsu |
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

Bucket certificate-documents tetap privat, PDF maksimum 10 MiB, restrictive deny untuk anon/authenticated. Upload/download/signed URL belum aktif; tidak ada dokumen nyata diunggah.

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

Windows dapat memakai $env:PLAYWRIGHT_CHANNEL='msedge'. Empat browser tests anonim berjalan tanpa akun. Sembilan authenticated tests memerlukan fixture development terotorisasi terpisah dan dilewati bila .tools/phase02-identities.json tidak ada. Tidak ada pembuatan akun otomatis pada CI. Hasil sesi ini: 19 unit/security dan 13 browser lulus, suite RLS lulus, lint/typecheck/build lulus. CI cloud belum dijalankan.

## Berikutnya

Organisasi perlu menyediakan akun Auth resmi dan bootstrap Admin pertama melalui administrator database berwenang, dengan pegawai terverifikasi/grant cabang eksplisit. Sesudahnya Admin mengelola profil/grant lain dari UI. Katalog CONTOH jenis sertifikat perlu ditinjau sebelum menjadi referensi resmi; tidak ada regulasi/identitas pegawai yang dikarang.

Leaked-password protection belum aktif dan sempat memunculkan WARN ketika akun uji tersedia; fitur memerlukan [Supabase Pro atau lebih tinggi](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Sesudah cleanup, security advisor hanya memuat INFO ledger audit private tanpa policy, yang sengaja menolak client. Paket tetap Free sesuai arahan pengguna; unused indexes pada database kosong bukan benchmark produksi.

**Prompt 03 — Sertifikat Klien, Kompetensi Personil, dan Kalibrasi Alat CRUD** belum dimulai.
