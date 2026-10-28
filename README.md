# VALIDA — Validity Alert & Data Archive

Fondasi aplikasi internal **PT SUCOFINDO Cabang Denpasar**, kode cabang **DPS**, wilayah Bali, NTB, dan NTT. Bahasa aplikasi adalah Bahasa Indonesia; zona waktu **Asia/Makassar (WITA, UTC+8)**.

Tahap 01 hanya menyiapkan infrastruktur. Belum ada modul sertifikasi pelanggan, kompetensi personel, inventaris/kalibrasi, peluang pembaruan, pengiriman email, atau pelaporan operasional. Tidak ada statistik, pelanggan, pegawai, akun, atau dokumen operasional fiktif.

## Status dan arsitektur

Next.js App Router → Server Components/Server Actions → Supabase Auth, PostgreSQL + RLS, serta Storage privat. Microsoft Graph dipisahkan dari autentikasi aplikasi. GitHub Actions memeriksa sumber; deployment Vercel disiapkan tetapi belum diaktifkan. Lihat [laporan verifikasi](docs/setup-report.md) untuk status aktual dan batasannya.

Proyek Supabase development yang telah dibuat dan diverifikasi:

- Nama: `valida-dps-dev`; referensi: `vzxmnkmvcbzxrkzdtxuy`.
- Organisasi: Genset Corp, paket Free; region Singapore `ap-southeast-1`.
- PostgreSQL 17.11; migrasi fondasi telah diterapkan lewat konektor yang diotorisasi.
- [Dashboard proyek](https://supabase.com/dashboard/project/vzxmnkmvcbzxrkzdtxuy).
- Tidak ada proyek produksi yang dibuat.

Koneksi SDK tidak otomatis membuktikan layanan terhubung. Verifikasi dibedakan antara aplikasi, REST/Auth, pengujian SQL, CLI, GitHub, dan deployment.

## Teknologi dan persyaratan

Gunakan Node.js **24 LTS** (terverifikasi 24.22.1), npm **11 atau 12** (terverifikasi 12.2.1), Git (terverifikasi 2.53.0.windows.3), serta Docker Desktop/Podman untuk Supabase lokal. Seluruh dependensi langsung dipin tanpa `^`/`~`; `package-lock.json` harus disimpan di Git.

Versi inti: Next.js 16.4.3, React/React DOM 19.3.1, TypeScript 5.9.3, Tailwind 4.3.3, Supabase JS 2.118.0, SSR 0.12.7, CLI 2.122.0. Versi lainnya tercantum pada `package.json`. ESLint 10 menggunakan plugin Next, React Hooks, dan typescript-eslint yang menyatakan kompatibilitas dengannya; tidak memaksakan plugin React/import lama yang belum mendukung ESLint 10.

shadcn/ui dikonfigurasi melalui `components.json`, token CSS, utilitas `cn`, dan komponen sumber Button/Input/Card. Radix, class-variance-authority, clsx, tailwind-merge, serta Lucide menyediakan fondasinya. Tidak diperlukan paket runtime bernama shadcn/ui. Space Grotesk dan Public Sans disajikan lokal melalui Fontsource agar build tidak bergantung pada Google Fonts.

## Struktur proyek

```text
src/app/                  Halaman, route API, autentikasi, dashboard awal
src/components/ui/        Komponen shadcn/ui yang dapat diedit
src/components/shared/    Formulir autentikasi
src/lib/auth/             Guard akun aktif dan validasi input
src/lib/env/              Validasi konfigurasi publik/server
src/lib/supabase/         Client browser/server dan batas Storage
src/lib/microsoft/        Kontrak integrasi Microsoft 365 nonaktif
src/types/database.ts     Tipe hasil generasi dari database development
src/proxy.ts              Penyegaran cookie SSR Supabase
supabase/migrations/      Migrasi fondasi terversi
supabase/tests/           Pengujian otorisasi SQL/pgTAP
supabase/config.toml      Database, Auth, dan Storage lokal
scripts/                  Generasi tipe serta probe koneksi baca-saja
tests/                    Unit/security tests dan browser tests
.github/workflows/ci.yml   CI aplikasi dan database lokal
docs/                     Integrasi, deployment, dan laporan setup
```

## Instalasi dan menjalankan aplikasi

```powershell
npm ci
Copy-Item .env.example .env.local
# Isi publishable URL/key development yang disetujui tanpa menampilkan secret.
npm run dev
```

Buka [localhost:3000](http://localhost:3000). Halaman publik berisi identitas, batas tahap pengembangan, dan navigasi masuk. `/login`, `/reset-password`, serta `/update-password` menyiapkan alur autentikasi. `/dashboard` memerlukan identitas terverifikasi dan profil aktif. `/api/health` hanya melaporkan kesehatan aplikasi, bukan keberhasilan integrasi eksternal.

Pada komputer setup ini, executable npm tidak berada di PATH. npm resmi 12.2.1 tersedia sementara pada direktori **diabaikan Git** `.tools/package/bin/npm-cli.js`. Perintah lokal yang setara: `node .tools/package/bin/npm-cli.js run dev`. Untuk clone baru, pasang Node 24 beserta npm resmi terlebih dahulu; jangan menyalin `node_modules` atau `.tools` ke repositori.

Build dan produksi lokal:

```powershell
npm run build
npm start
```

## Environment variables

Salin nama variabel dari `.env.example`. `.env.local` tidak boleh masuk Git.

| Variabel | Kegunaan |
|---|---|
| APP_URL | Origin tepercaya untuk callback; localhost saat development, HTTPS pada hosting |
| NEXT_PUBLIC_APP_NAME / NEXT_PUBLIC_BRANCH_CODE | Identitas aplikasi; otorisasi cabang tetap dari database |
| APP_TIMEZONE | Asia/Makassar |
| NEXT_PUBLIC_SUPABASE_URL | Endpoint proyek development yang telah disetujui |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Publishable key `sb_publishable_...`; boleh pada browser |
| SUPABASE_SECRET_KEY | Server-only; tidak dipakai aplikasi tahap 01 |
| MICROSOFT_TENANT_ID / CLIENT_ID / CLIENT_SECRET / REDIRECT_URI | Konfigurasi Entra server-only; kosong sampai disetujui |
| OUTLOOK_NOTIFICATION_MAILBOX | Mailbox notifikasi resmi yang ditetapkan organisasi |
| ENABLE_OUTLOOK_EMAIL / ENABLE_OUTLOOK_COMMERCIAL | Default false; true saja tidak mengaktifkan implementasi yang masih ditutup |
| CRON_SECRET | Cadangan autentikasi cron masa depan; tidak ada cron aktif |

Validasi menolak secret key pada konfigurasi publik serta URL backend remote tanpa HTTPS. `.env.example` tidak berisi kredensial nyata. Tidak ada penggunaan legacy service-role key. Log, pesan error, dan laporan tidak boleh memuat token, kata sandi, atau secret.

## Supabase lokal dan development

CLI dipin sebagai dev dependency. Perintah sudah diperiksa melalui `--help` pada versi 2.122.0. Konfigurasi lokal menonaktifkan signup dan anonymous sign-in, mengaktifkan konfirmasi email, serta panjang kata sandi minimal 12 karakter. SMTP lokal menangkap email pengujian; jangan menggunakannya untuk pengiriman produksi.

```powershell
npx supabase --version
npx supabase start --help
npm run db:start
npm run db:lint
npm run db:test
npm run db:types
```

Docker/Podman tidak tersedia pada komputer setup, sehingga stack lokal belum dapat berjalan. Database development cloud telah diuji melalui konektor Supabase. Login konektor tidak mengautentikasi CLI secara otomatis. Jangan membuat file link palsu untuk mengklaim CLI sudah terhubung.

Setelah login CLI oleh pemilik akun:

```powershell
npx supabase login
npx supabase link --project-ref vzxmnkmvcbzxrkzdtxuy
npx supabase migration list
npx supabase config diff --help
# Tinjau seluruh perbedaan sebelum menerapkan konfigurasi remote.
```

Migrasi lokal bernomor `20261028032607` diselaraskan dengan riwayat aktual migrasi development yang diterapkan konektor. Jangan menerapkan ulang migrasi yang sama. Untuk perubahan baru, gunakan `npx supabase migration new <nama>`, review SQL, uji lokal, dan lakukan deployment development secara sadar. Tidak ada deployment database produksi otomatis. `db:types` menjaga file lama bila generasi gagal; tipe yang disimpan saat setup dihasilkan dari database cloud yang telah diterapkan.

## Auth, aktivasi, RLS, dan audit

Browser menggunakan publishable key. Server membuat client per request dengan cookie SSR; `proxy.ts` menyegarkan token melalui `getClaims`. Guard server memeriksa `getUser` ke Auth dan membaca profil aktif dari database, sehingga status aktivasi tidak bergantung pada metadata yang dapat diubah pengguna. Respons sesi tidak di-cache bersama.

Tidak ada route signup, akun demo, atau trigger yang memberi hak dari `user_metadata`. Pembuatan akun dan profil dilakukan administrator melalui operasi yang ditinjau. Profil default tidak aktif; aktivasi memerlukan timestamp. Cabang dan role tidak dapat ditulis pengguna, termasuk oleh akun berlabel admin pada tahap ini. Antarmuka administrasi belum dibuat. Setiap perubahan profil dicatat pada `private.profile_authorization_audit`; fungsi security definer berada di schema privat, search_path kosong, dan hak execute publik dicabut. Ledger audit tidak dapat dibaca/ditulis client.

RLS aktif pada branches, roles, profiles, dan audit privat. Pengguna aktif hanya membaca profilnya sendiri, cabangnya, serta role yang ditugaskan. Anon tidak memiliki SELECT tabel organisasi. Tidak ada grant tulis untuk authenticated. Katalog awal hanya DPS, member, dan admin. Seluruh tabel bisnis di tahap berikutnya wajib memiliki `branch_code` dan otorisasi yang ditinjau.

**Pengaturan Auth cloud diverifikasi terpisah**: administrator telah menonaktifkan `Allow new users to sign up`, dan probe baca-saja mengonfirmasi `publicSignupDisabled: true` serta login email aktif. Selanjutnya atur URL situs/callback tepat dan tinjau batas laju/CAPTCHA serta mekanisme email pemulihan. `npm run check:connections` dapat mengulang pemeriksaan. Konfigurasi lokal tidak otomatis mengubah konfigurasi cloud. Alur login berhasil/reset/logout belum diuji dengan akun pegawai karena tidak ada akun yang diizinkan dibuat; jangan menyatakan integrasi Auth end-to-end lengkap sebelum pengujian oleh akun resmi.

## Storage sertifikat

Bucket `certificate-documents` sudah privat, MIME `application/pdf`, batas 10 MiB. Nilai batas dapat diubah melalui **migrasi baru yang ditinjau** dan harus diselaraskan dengan `CERTIFICATE_MAX_BYTES` serta config lokal. Restrictive policy menutup operasi anon/authenticated pada bucket ini, termasuk bila permissive policy lain ditambahkan. Tidak ada dokumen nyata yang diunggah.

Helper memvalidasi ekstensi, MIME, ukuran, dan signature `%PDF-`. Ini bukan pemeriksaan malware; sebelum unggah diaktifkan perlu verifikasi isi PDF, nama/path server, dan pemeriksaan sesuai kebijakan organisasi. Upload, preview, download, dan pembuatan signed URL saat ini melempar error. TTL rencana signed URL adalah 60 detik dan baru boleh digunakan setelah otorisasi terhadap rekaman bisnis dan cabang tersedia. Tidak ada privileged Storage client yang melewati RLS.

## Microsoft 365, GitHub, dan Vercel

Lihat [panduan Microsoft 365](docs/microsoft-365.md) untuk registrasi `VALIDA-DPS-Mail-Integration`, pemisahan delegated/application Mail.Send, OAuth, pembatasan mailbox, token cache, dan perbedaan accepted/delivered. Tidak ada Entra app, grant consent, koneksi mailbox, atau pengiriman nyata yang diklaim.

Lihat [panduan GitHub/Vercel](docs/deployment.md) untuk publikasi privat, CI, environment terpisah, serta batas paket hosting. Cron masa depan **07.00 WITA = `0 23 * * *` UTC** hanya didokumentasikan; belum ada jadwal atau endpoint pengingat aktif.

## Pemeriksaan dan pengujian

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run check:connections
# Memerlukan Docker/Podman:
npm run db:lint
npm run db:test
```

Pada Windows dengan Edge terpasang, set `$env:PLAYWRIGHT_CHANNEL = 'msedge'` sebelum test:e2e. Unit tests memeriksa kegagalan konfigurasi, kebocoran secret melalui env publik, penolakan pengiriman email, validasi PDF, serta akses dokumen tertutup. Browser tests memeriksa beranda, navigasi pemulihan, redirect anonim, callback Microsoft tertutup, dan layout seluler. SQL/pgTAP menguji akses positif dan negatif, memakai UUID sintetis tanpa email/kata sandi, lalu rollback seluruh fixture. Tidak ada data uji tersisa di cloud.

Probe koneksi bersifat baca-saja dan sengaja gagal bila public signup cloud masih aktif. CI tidak memakai `.env.local` atau kredensial produksi dan tidak mengirim email. Riwayat eksekusi lokal serta pemeriksaan cloud yang benar-benar dilakukan tercantum pada laporan.

## Persetujuan/tindakan yang masih diperlukan

- Hak tulis GitHub melalui CLI atau repositori privat resmi; push commit dan verifikasi run CI cloud.
- Login CLI Supabase, link ref development, review/sinkronisasi konfigurasi Auth cloud, serta pemasangan Docker bila pengujian lokal diperlukan.
- Administrator menyediakan akun uji resmi yang disetujui untuk login/aktivasi/reset/logout.
- Akun/tim Vercel yang sesuai untuk penggunaan perusahaan dan persetujuan biaya sebelum deployment; pengguna saat setup memilih hanya opsi gratis.
- Tenant/credential Entra, administrator organisasi, mailbox notifikasi resmi, izin minimum dengan pembatasan mailbox, penyimpanan token terenkripsi, dan otorisasi delegated AM.
- Logo SUCOFINDO asli yang disetujui; aplikasi sekarang memakai teks placeholder.

Tahap berikutnya adalah **PROMPT 02 — VALIDA Database Schema, Role-Based Access Control, and Master Data Implementation** setelah fondasi dan persetujuan eksternal yang relevan diverifikasi. Tahap tersebut belum diimplementasikan.
