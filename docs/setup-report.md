# Laporan Setup Infrastruktur VALIDA

Tanggal: **28 Oktober 2026**, zona waktu Asia/Makassar. Lingkup: **PROMPT 01**. Modul bisnis PROMPT 02 belum dibuat.

## A. Status infrastruktur

| Komponen | Status | Bukti atau batas verifikasi |
|---|---|---|
| GitHub Repository | **Menunggu Otorisasi** | Akun gensetassemble terverifikasi; konektor tidak menyediakan pembuatan/push repositori, credential Git belum tersedia |
| Next.js Application | **Berhasil & Terverifikasi** | Build produksi dan empat skenario browser berhasil |
| TypeScript | **Berhasil & Terverifikasi** | Strict mode; typecheck serta kompilasi Next lulus |
| Tailwind CSS | **Berhasil & Terverifikasi** | CSS build dan halaman desktop/seluler diperiksa |
| shadcn/ui | **Berhasil & Terverifikasi** | Config, token, Button/Input/Card dipakai pada halaman yang diuji |
| Supabase Project | **Berhasil & Terverifikasi** | valida-dps-dev, Singapore, Free, ACTIVE_HEALTHY |
| Supabase PostgreSQL | **Berhasil & Terverifikasi** | PostgreSQL 17.11, migrasi fondasi diterapkan, query nyata berhasil |
| Supabase Auth | **Terkonfigurasi — Belum Diuji** | Endpoint aktif; email/password aktif dan public signup sudah terverifikasi nonaktif. Login/reset/logout dengan akun resmi belum diuji |
| Supabase RLS | **Berhasil & Terverifikasi** | Uji SQL positif/negatif terhadap development lulus; akses REST anonim HTTP 401 |
| Supabase Storage | **Berhasil & Terverifikasi** | Bucket privat, PDF, 10 MiB; upload/read client ditolak. Preview/download belum diaktifkan |
| Microsoft Entra Integration | **Menunggu Otorisasi** | Lingkungan Microsoft 365 kerja/sekolah dikonfirmasi; tenant, registrasi, consent, credential belum tersedia |
| Microsoft Graph API | **Terkonfigurasi — Belum Diuji** | Dependency, validasi, MSAL dan factory Graph tersedia; belum ada panggilan Graph terotorisasi |
| Outlook Notification Mailbox | **Menunggu Otorisasi** | Mailbox resmi dan pembatasan izin administrator belum ditetapkan; send selalu ditolak |
| Outlook Commercial Mail | **Menunggu Otorisasi** | Delegated OAuth, token store dan konfirmasi per pesan perlu implementasi; send selalu ditolak |
| Vercel Project | **Menunggu Otorisasi** | Akun yang tersedia Hobby; belum tersedia paket organisasi yang sesuai penggunaan perusahaan |
| Vercel Deployment | **Menunggu Otorisasi** | Konfigurasi lokal siap; belum ada build cloud atau URL deployment |
| GitHub Actions | **Terkonfigurasi — Belum Diuji** | Workflow aplikasi/database tersedia; run GitHub belum dapat dilakukan sebelum push |

Git lokal menggunakan branch main. Repository remote belum dibuat, remote origin belum dipasang, dan tidak ada push atau run CI cloud yang diklaim.

## B. Informasi terverifikasi

- Workspace: `D:\Coding\valida-dps`.
- Akun GitHub konektor: `gensetassemble`; tanpa organisasi tambahan dan daftar repositori akun kosong saat inspeksi. **URL repositori belum tersedia**.
- Supabase: `valida-dps-dev`, ref `vzxmnkmvcbzxrkzdtxuy`, organisasi `Genset Corp` (`nxouevdwysqmkmtwleng`), Free, Singapore `ap-southeast-1`. Pengguna menyetujui pilihan gratis. Tidak ada upgrade berbayar atau proyek produksi.
- [Supabase dashboard](https://supabase.com/dashboard/project/vzxmnkmvcbzxrkzdtxuy).
- Akun Vercel: `gensetassemble-7531`, Hobby. **URL deployment belum tersedia**.
- Node.js 24.22.1; npm 12.2.1; Git 2.53.0.windows.3; Supabase CLI 2.122.0; Docker/Podman tidak tersedia.
- Next.js 16.4.3, React 19.3.1, TypeScript 5.9.3, Tailwind CSS 4.3.3, Supabase JS 2.118.0, Supabase SSR 0.12.7, MSAL Node 7.1.2, Graph client 3.0.7. Daftar lengkap dipin pada package.json/package-lock.json.
- Pengembangan: `npm ci`, salin `.env.example` ke `.env.local` dan isi konfigurasi development, lalu `npm run dev`. npm sementara pada komputer ini dijalankan dengan `node .tools/package/bin/npm-cli.js <perintah>` karena npm tidak berada di PATH.

## C. Perubahan penting

- Next App Router, strict TypeScript, alias @/*, Tailwind, Lucide, komponen sumber shadcn/ui, form React Hook Form/Zod, font lokal Space Grotesk/Public Sans, dan shell Bahasa Indonesia dengan warna merek.
- Client Supabase browser/server, cookie SSR, proxy penyegaran token, guard identitas dan profil aktif, login/logout, pemulihan kata sandi, error/loading/not-found, serta endpoint health minimal.
- Migrasi `20261028032607_infrastructure_foundation.sql`: branch DPS, role member/admin, profil inactive by default, metadata aktivasi, audit privat, RLS/grant minimal, dan bucket privat. Nomor file diselaraskan dengan versi aktual yang diterapkan konektor.
- Tipe database dibuat ulang melalui konektor dari skema yang benar-benar diterapkan.
- Validasi environment publik/server, security headers, cookie Secure pada produksi, no-store untuk respons sesi, gitignore kredensial/data sensitif.
- Kontrak MailProvider, config Entra single tenant, MSAL, Graph factory, callback OAuth tertutup, token-store yang menolak penulisan, serta pengiriman yang tidak pernah mensimulasikan sukses.
- CI tanpa secret produksi: npm ci, lint, typecheck, unit/security test, build, browser test, Supabase lokal, lint database, serta pgTAP. Tidak ada migrasi remote otomatis.
- README Bahasa Indonesia, panduan Microsoft 365, deployment/GitHub, dan laporan ini. `vercel.json` menyiapkan Next.js/Singapore, tanpa cron.

## D. Hasil verifikasi

| Pemeriksaan/perintah | Hasil aktual |
|---|---|
| Inspeksi awal direktori, Git, CLI, environment | Workspace kosong, belum Git, tidak ada env/secret atau kode yang ditimpa |
| npm install / npm ci | Lockfile dibuat; instalasi bersih akhir berhasil; audit npm melaporkan 0 kerentanan |
| npm run lint | Lulus |
| npm run typecheck | Lulus |
| npm test | 9 pengujian lulus |
| npm run build | Lulus; halaman dan route App Router berhasil dibangun |
| npm run dev | Server siap dalam 482 ms pada http://localhost:3000 |
| npm run test:e2e, Edge headless | Empat skenario berhasil: navigasi beranda/login/reset; dashboard anonim ditolak; callback Microsoft HTTP 503; layout seluler tanpa overflow |
| Pemeriksaan visual screenshot | Desktop 1280 px dan seluler 390 px diperiksa; font lokal dan identitas tampil |
| apply_migration melalui konektor Supabase | Sukses pada development; nama/version riwayat diperiksa |
| SQL/pgTAP supabase/tests/foundation.sql via execute_sql | `ok 1 - Profile, branch, role, activation, audit and private storage authorization` |
| Probe REST/Auth/Storage | Profil anonim HTTP 401; metadata bucket privat HTTP 400; Auth reachable, email enabled, publicSignupDisabled true |
| Verifikasi setelah rollback SQL | auth.users 0, profiles 0, audit_rows 0; fixture tidak tersimpan |
| Security advisor Supabase | Tidak ada ERROR/WARN pada pemeriksaan; satu INFO: audit privat RLS tanpa policy, disengaja deny-by-default dan schema/grant client dicabut |
| Performance advisor Supabase | Tiga INFO unused_index untuk foreign-key profiles; wajar karena tabel belum memiliki data operasional, index dipertahankan |
| supabase start | Gagal karena Docker/Podman tidak terpasang; cloud development tetap diuji |
| supabase whoami / CLI link | CLI belum memiliki token; link CLI belum diklaim |
| GitHub repo/push/CI | Belum dapat dijalankan: konektor tanpa operasi create/push dan credential Git tidak tersedia |
| Microsoft Graph connection / delivery | Tidak dijalankan; tidak ada credential/consent/sender yang disetujui; tidak ada email terkirim |
| Vercel deployment | Tidak dijalankan; paket Hobby tidak sesuai penggunaan perusahaan, pengguna meminta pilihan gratis |

Pengujian SQL memakai tiga UUID sintetis dalam satu transaksi, tanpa email/kata sandi, lalu rollback. Pengujian tidak membuat akun pegawai atau dokumen operasional. RLS diuji untuk profil sendiri, cabang sendiri, role terpasang, penolakan lintas pengguna/cabang, penolakan perubahan role/cabang, penolakan self-activation, penolakan anon, penolakan upload, bucket privat/PDF/ukuran, dan pencatatan audit provisioning.

Informasi advisor: [RLS enabled without policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Audit privat sengaja hanya ditulis trigger terkontrol; tidak ada policy baca/tulis client. Jangan menambahkan policy broad untuk menghilangkan INFO tersebut.

Informasi performa: [Unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). Index foreign-key disiapkan untuk akses dan pemeriksaan relasi berikutnya; tidak dihapus hanya karena basis data awal kosong.

## E. Tindakan administrator yang masih diperlukan

1. Sediakan autentikasi GitHub CLI/hak tulis untuk akun gensetassemble atau repositori privat resmi. Periksa kembali keberadaan repo sebelum membuatnya; push main tanpa force, verifikasi private/default branch/commit, lalu periksa run CI cloud. Langkah konkret tersedia pada docs/deployment.md.
2. Login Supabase CLI, link ref development, periksa riwayat migrasi, lalu review konfigurasi remote. Public signup sudah nonaktif; redirect URL/site URL, password policy, dan pengiriman email Auth masih perlu diverifikasi oleh administrator. Jangan menerapkan seluruh config lokal tanpa meninjau dampaknya.
3. Pasang Docker/Podman bila stack lokal diperlukan. Jalankan db:lint, db:test, dan db:types lokal. Tidak ada klaim bahwa runtime lokal sudah berjalan.
4. Sediakan akun uji resmi yang disetujui, aktifkan profil lewat administrator, dan uji login/logout/reset, rotasi sesi, serta pencabutan aktivasi. Tidak ada akun fiktif yang dibuat untuk melewati kebutuhan ini.
5. Tetapkan tenant dan mailbox Microsoft 365 resmi. Administrator mendaftarkan Entra app, menyetujui Mail.Send minimum dan scope mailbox, serta menyediakan mekanisme credential/token terenkripsi. Implementasikan dan uji state/PKCE/token binding sebelum OAuth diaktifkan. Jangan mengirim email pada tahap ini.
6. Sediakan akun/tim hosting Vercel dengan paket yang mengizinkan aplikasi perusahaan, beserta persetujuan biaya bila ada. [Dokumentasi paket Hobby](https://vercel.com/docs/plans/hobby) membatasi penggunaan pribadi nonkomersial. Tidak ada pengeluaran/upgrade otomatis.
7. Setelah hosting disetujui, hubungkan GitHub privat, batasi preview, isi env per lingkungan, deploy shell, lalu catat dan uji URL aktual. Jangan hubungkan preview ke database produksi.
8. Sediakan logo SUCOFINDO resmi; saat ini hanya teks placeholder. Unggah dokumen tetap dinonaktifkan sampai tabel/kebijakan per rekaman tersedia.

Cron mendatang: **07.00 WITA**, ekspresi UTC **0 23 * * ***. Aktivasi menunggu endpoint, CRON_SECRET, idempotensi, logging, sender Graph yang disetujui, dan integration tests. Tidak ada cron aktif.

## F. Tahap selanjutnya

**PROMPT 02 — VALIDA Database Schema, Role-Based Access Control, and Master Data Implementation.**

Lanjutkan setelah verifikasi fondasi dan keputusan organisasi yang relevan selesai. Tahap ini belum membangun tabel pelanggan/personel/peralatan atau mesin pengingat.
