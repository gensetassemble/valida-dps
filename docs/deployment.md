# Deployment, GitHub, dan jadwal pengingat

## GitHub

Akun konektor terverifikasi: `gensetassemble`, tanpa organisasi GitHub lain. Belum ada repositori yang dapat diakses pada akun tersebut. Konektor yang tersedia tidak dapat membuat repositori atau mengunggah sumber. Git Credential Manager belum menyediakan kredensial untuk github.com; jangan memakai token konektor lain sebagai token GitHub.

Dengan GitHub CLI resmi yang telah diautentikasi sebagai akun tersebut:

```powershell
gh auth login
gh auth status
gh repo view gensetassemble/valida-dps --json nameWithOwner,visibility,defaultBranchRef
```

Jika repositori benar-benar belum ada (bukan sekadar error akses), buat privat:

```powershell
gh repo create gensetassemble/valida-dps --private --description "VALIDA — Validity Alert & Data Archive | PT SUCOFINDO Cabang Denpasar" --source . --remote origin --push
```

Jika sudah ada, periksa isi dan riwayat terlebih dahulu; tambahkan origin hanya setelah diverifikasi. Jangan force push. Default branch harus main. Verifikasi `gh repo view`, `git ls-remote origin main`, dan `gh run list`. Workflow memakai credential minimal `contents: read`, npm ci, lint, typecheck, unit tests, build, browser tests, dan pengujian RLS pada Supabase lokal. Tidak ada secret produksi dalam job pull request, migrasi remote otomatis, atau jadwal email.

## Vercel

Akun saat inspeksi: `gensetassemble-7531`, paket Hobby. [Paket Hobby](https://vercel.com/docs/plans/hobby) dibatasi untuk penggunaan pribadi nonkomersial. VALIDA adalah aplikasi internal perusahaan, sehingga proyek/deployment ditunda sampai akun atau tim dengan paket yang sesuai disetujui. Tidak ada peningkatan paket, tagihan, proyek, atau deployment yang dibuat.

Setelah organisasi menyediakan akses yang sesuai:

1. Periksa ulang proyek `valida-dps` agar tidak duplikat, hubungkan repositori GitHub privat yang benar.
2. Pilih Next.js, Node 24, npm ci, npm run build. `vercel.json` menyiapkan fungsi di Singapore (`sin1`).
3. Aktifkan Deployment Protection dan preview untuk branch/PR yang disetujui.
4. Atur env development/preview ke Supabase **development**. Preview tidak boleh menerima kredensial atau database produksi. Jangan menyalin `.env.local` ke Git atau mengunggahnya sebagai berkas deployment.
5. Env production baru diisi setelah proyek produksi terpisah disetujui. Tahap ini tidak membuat Supabase produksi.
6. Isi `APP_URL` dengan URL resmi environment; tambahkan callback tepat pada allowlist Supabase dan Entra. Validasi HTTPS.
7. Secret Microsoft, CRON_SECRET, dan kunci Supabase istimewa tetap server-only. Aplikasi tahap 01 tidak membutuhkan kunci Supabase secret.
8. Jalankan seluruh quality gates, verifikasi build log, route `/`, `/login`, `/api/health`, redirect `/dashboard`, dan tidak adanya secret pada client bundle. Catat URL aktual setelah deployment berhasil.

Jangan menyebut SDK terpasang sebagai koneksi Vercel yang berhasil. Konfigurasi lokal telah disiapkan; belum ada build cloud/URL deployment.

## Vercel Cron — belum aktif

Kebutuhan mendatang: **07.00 WITA** (`Asia/Makassar`, UTC+8), setara **23.00 UTC hari sebelumnya**. Ekspresi: `0 23 * * *`.

`vercel.json` sengaja belum mempunyai `crons`. Sebelum jadwal ditambahkan, wajib ada endpoint pengingat, autentikasi `Authorization: Bearer <CRON_SECRET>`, idempotency key/constraint per kejadian-tanggal-penerima, kontrol eksekusi bersamaan, retry tanpa duplikasi, log notifikasi, sender Microsoft Graph yang disetujui, dan integration tests. Log provider accepted tidak boleh dianggap delivered. Tidak ada endpoint cron atau pengiriman bisnis otomatis pada tahap 01.
