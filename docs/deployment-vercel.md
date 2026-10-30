# Deployment VALIDA ke Vercel

Repositori: https://github.com/gensetassemble/valida-dps (privat).

Panduan ini menyiapkan deployment aplikasi dengan database development yang sudah berisi data. Proyek Supabase produksi belum dibuat. Untuk rilis organisasi, gunakan proyek database produksi yang ditetapkan organisasi dan migrasikan sumber privat melalui proses terkontrol; Git hanya membawa kode/skema.

## 1. Import repositori

1. Login Vercel dengan akun/team organisasi, lalu pilih **Add New → Project**.
2. Hubungkan GitHub dan berikan akses pada repositori `gensetassemble/valida-dps`.
3. Pilih **Import**, framework **Next.js**, Root Directory `./`, dan branch `main`.
4. Gunakan Node.js **24.x**, Install Command `npm ci`, Build Command `npm run build`; biarkan Output Directory default.

`vercel.json` sudah menetapkan region fungsi **Singapore (`sin1`)**, dekat database development. Hindari mode static export: aplikasi memakai Auth, server actions, RLS, dan route handler.

Vercel Hobby diperuntukkan penggunaan personal nonkomersial. Sesuaikan paket/team dengan penggunaan internal perusahaan; tidak ada peningkatan paket otomatis dari proyek ini. Lihat [ketentuan Hobby](https://vercel.com/docs/plans/hobby).

## 2. Isi environment variables

Masukkan nilainya langsung di pengaturan Vercel, bukan melalui commit Git atau chat. Untuk uji deployment ke database development saat ini:

| Nama                                   | Nilai / sumber                                                              |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Project URL dari Supabase development yang telah disetujui                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key dari proyek Supabase yang sama                              |
| `APP_URL`                              | Origin HTTPS deployment stabil, misalnya `https://<nama-proyek>.vercel.app` |
| `APP_TIMEZONE`                         | `Asia/Makassar`                                                             |
| `NEXT_PUBLIC_APP_NAME`                 | `VALIDA`                                                                    |
| `NEXT_PUBLIC_BRANCH_CODE`              | `DPS`                                                                       |
| `ENABLE_OUTLOOK_EMAIL`                 | `false`                                                                     |
| `ENABLE_OUTLOOK_COMMERCIAL`            | `false`                                                                     |

Pilih environment yang sesuai. Preview yang menunjuk database development tetap mengakses data development dengan RLS; pisahkan konfigurasi ketika database produksi tersedia. Publishable key memang dipakai browser, tetapi secret/service-role key tidak diperlukan aplikasi ini. Biarkan `SUPABASE_SECRET_KEY`, credential Microsoft, mailbox, dan `CRON_SECRET` kosong selama integrasi server tersebut belum diaktifkan.

Jika domain final baru diketahui setelah deployment pertama, perbarui `APP_URL`, lalu **Redeploy** agar callback pemulihan memakai origin yang benar. Perubahan environment diterapkan ke deployment berikutnya. Jangan menyalin seluruh `.env.local` tanpa memilih field yang dibutuhkan.

## 3. Konfigurasi Supabase Auth

Di proyek Supabase yang digunakan, buka **Authentication → URL Configuration**:

- **Site URL:** origin HTTPS deployment stabil.
- **Redirect URLs:** `https://<domain-final>/auth/callback`; pertahankan `http://localhost:3000/auth/callback` bila pengembangan lokal masih dipakai.
- Pendaftaran publik tetap nonaktif. Direktori pegawai dan roster AM tidak membuat akun login.

Pemulihan kata sandi nyata memerlukan pengiriman email/SMTP yang telah dikonfigurasi organisasi. Tombol draft Outlook memakai compose Microsoft 365 dan tidak bergantung pada pengiriman email dari Supabase maupun Microsoft Graph aplikasi.

## 4. Deploy dan periksa

Klik **Deploy**. Setelah status **Ready**, buka URL deployment dan periksa:

1. `/login` tampil; halaman data mengarah ke login ketika belum masuk.
2. Login akun yang ditugaskan untuk environment itu. Pastikan daftar, filter, popup, scroll tabel, dan ekspor bekerja.
3. Cocokkan jumlah data dengan database yang dipilih. Jika memakai development saat ini: 173 alat internal, 54 lisensi, serta sertifikat klien `[CONTOH]` yang tetap diberi label.
4. Di pipeline, seret kartu ke tahap berikutnya: gate wajib terbuka; membatalkan gate mempertahankan posisi. Mengirim penawaran/konfirmasi PO tetap membutuhkan bukti PDF yang sesuai.
5. **Buka draft di Outlook** menyiapkan penerima, subjek, dan isi. Login Microsoft 365 bila diminta, periksa isi, lampirkan PDF resmi, lalu kirim sendiri. Membuka compose tidak otomatis menandai komunikasi selesai.
6. Coba **Logout** dan pastikan akses data kembali meminta login.

Gunakan **Runtime Logs** di Vercel untuk menelusuri kegagalan. Error konfigurasi biasanya diselesaikan dengan mencocokkan URL/key Supabase, environment, dan `APP_URL`, lalu redeploy. Jangan menonaktifkan RLS untuk memperbaiki akses.

## 5. Pembaruan berikutnya

Setelah Git integration aktif, push ke branch selain production menghasilkan preview; push ke production branch biasanya memulai deployment production. Pilih alur review organisasi sebelum menjadikan deployment dapat digunakan operasional. GitHub Actions menjalankan pemeriksaan aplikasi dan database; tes browser yang membutuhkan fixture akun privat tidak membuat akun baru otomatis di CI.

Pastikan deployment production berstatus **Ready**, commit SHA cocok dengan GitHub `main`, dan alias `valida-dps.vercel.app` menunjuk deployment itu. Push Git dan domain yang siap dilayani adalah dua pemeriksaan terpisah. Nomor rilis kini terlihat pada halaman login/footer; `/api/health` menyediakan `release` serta commit SHA singkat tanpa kredensial. Setelah rilis baru, muat ulang tab lama agar komponen yang sudah terbuka diganti.

Untuk preview lokal yang lebih ringan daripada development:

```powershell
npm ci
npm run build
npm start
```

Mode `npm run dev` menampilkan indikator development dan mengompilasi rute saat diperlukan. Gunakan itu saat mengubah kode; jalankan `build` kembali sebelum memakai `start` untuk melihat perubahan kode terbaru.

Rujukan: [GitHub integration](https://vercel.com/docs/git/vercel-for-github), [environment variables](https://vercel.com/docs/environment-variables), [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
