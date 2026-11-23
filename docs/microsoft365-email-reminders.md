# Pengiriman email dan reminder Microsoft 365

Status development per 10 November 2026: kode, antrean database, pengaturan, dan
pengujian tersedia. Pengirim dipilih berupa **mailbox khusus organisasi**;
alamatnya masih menunggu. Belum ada pengiriman nyata atau aktivasi produksi.

## Cara kerja

**Email pelanggan**

1. AM/Admin membuka Email Perpanjangan dari sertifikat atau pipeline.
2. VALIDA menampilkan penerima, subjek, dan isi dari sertifikat serta template.
3. Pada mode resmi, PIC utama harus aktif, terverifikasi, dan memiliki email.
4. Pengguna memeriksa isi lalu mengonfirmasi **Ya, kirim sekarang**.
5. Server membaca ulang data dan template. Jika berubah, pratinjau harus dibuka
   ulang. Browser tidak dapat memasukkan penerima, token, atau isi bebas ke antrean.
6. Permintaan masuk antrean, dikunci worker, lalu dikirim melalui Microsoft Graph.
   Konfirmasi berulang untuk pesan dan versi data yang sama mengacu pada antrean
   yang sama.
7. Status **Diterima Microsoft 365** berarti Graph mengembalikan `202 Accepted`,
   bukan bukti pesan tiba di inbox. Pengiriman tidak memindahkan pipeline atau
   memperpanjang sertifikat. Pencatatan hasil kontak tetap tindakan terpisah.

Mode uji hanya dapat dikirim oleh Admin. Tujuannya selalu
`adli.alfian@sucofindo.co.id` dan pesannya diberi label uji internal.
Alamat dari browser atau PIC pelanggan tidak dapat mengganti tujuan uji ini.
Draf Outlook tetap tersedia sebagai alternatif pengiriman manual.

**Reminder internal**

| Data | Penerima |
| --- | --- |
| Sertifikat klien | Akun AM yang ditugaskan pada pelanggan tersebut |
| Kompetensi personil | HRGA, pemilik yang mempunyai akun, serta Koordinator portofolio lisensi |
| Kalibrasi alat | PTK dan Koordinator portofolio alat |

Penerima harus memiliki akun aktif dan peran aktif, identitas yang belum diarsip,
serta email `@sucofindo.co.id` yang sama dengan email akun Auth yang sudah
dikonfirmasi. Personil berstatus nonaktif dikecualikan. Penempatan umum pegawai
tidak menggantikan portofolio penanggung jawab pada lisensinya.

Ambang awal: H-90, H-60, H-30, H-7, hari terakhir, H+7, dan H+30. Super Admin dapat
mengubah maksimal delapan ambang pada **Email & Reminder**. Nilai negatif berarti
sudah lewat tanggal akhir. Ini bukan pengulangan harian tanpa batas: satu pesan
per rekaman, versi informasi yang relevan, tanggal akhir, ambang, dan penerima.
Apabila jadwal terlewat, hanya ambang terdekat yang disiapkan.

Reminder memakai sertifikat terkini/alat internal aktif; sertifikat seumur hidup,
tanggal kosong, data contoh, dan pemilik nonaktif dikecualikan. Data expired lama
yang masih aktif tetap dapat masuk ambang overdue. Saat data, penerima, atau
ambang berubah sebelum dikirim, antrean lama dibatalkan. Pesan memuat tanggal
snapshot WITA, nama/lisensi/nomor, portofolio, sisa/lewat hari, dan tautan rincian.
Alat juga menyertakan tag dan subunit pada identitasnya.

Cron awal: `0 0 * * *` atau sekitar 08.00 WITA setiap hari. Ketepatan waktu
mengikuti kemampuan paket Vercel; bukan janji pengiriman tepat per menit.
Mode live menyiapkan maksimal 100 reminder baru per pemanggilan. Worker
memproses hingga 100 antrean, berhenti menambah pekerjaan setelah sekitar empat
menit. Sisa pekerjaan tetap tercatat. Pada pilot test, pembentukan reminder dan
worker dibatasi tiga email per batch agar mailbox uji tidak dibanjiri pesan.

## Yang perlu disiapkan tim IT Microsoft 365

1. Tentukan mailbox organisasi yang menjadi pengirim. Implementasi ini memakai
   mailbox pusat untuk email pelanggan maupun reminder; bukan login Outlook
   pribadi setiap AM.
2. Buat aplikasi Entra **single tenant** dan service principal organisasi.
3. Berikan izin kirim melalui **Exchange Online Application RBAC**, dengan scope
   yang hanya memuat mailbox VALIDA. Uji bahwa mailbox itu diizinkan dan mailbox
   lain ditolak. Tidak diperlukan izin baca seluruh mailbox untuk fitur ini.
4. Periksa pula application permissions di Entra. Grant Mail.Send tanpa batas
   tenant tidak menjadi sempit hanya karena ditambah RBAC yang dibatasi; grant
   tersebut bersifat aditif. Administrator Exchange/Entra perlu memastikan
   identitas aplikasi benar-benar hanya dapat mengirim dari mailbox VALIDA.
5. Siapkan Tenant ID, Client ID, dan kredensial aplikasi dengan masa berlaku
   serta penanggung jawab rotasi. Implementasi awal mendukung client secret
   server-side. Penggunaan sertifikat/federasi dapat menjadi peningkatan berikutnya.
6. Masukkan nilai rahasia langsung melalui penyimpanan rahasia deployment atau
   `.env.local` development. Jangan mengirim secret, password mailbox, token,
   atau kode MFA melalui chat, dokumentasi, maupun Git.

Penggunaan application identity memungkinkan cron berjalan tanpa sesi login
pengguna. Token aplikasi berada di memori server; tidak ada refresh token
Outlook pengguna yang disimpan. Endpoint OAuth per pengguna yang lama tetap
ditutup karena tidak diperlukan pada arsitektur mailbox pusat ini.

## Variabel deployment

Gunakan nilai nyata hanya di pengaturan rahasia lingkungan tujuan. Template
variabel tanpa kredensial ada di `.env.example`.

| Variabel | Fungsi |
| --- | --- |
| `MICROSOFT_TENANT_ID` | Tenant organisasi |
| `MICROSOFT_CLIENT_ID` | Identitas aplikasi Entra |
| `MICROSOFT_CLIENT_SECRET` | Kredensial server; tidak memakai prefix NEXT_PUBLIC |
| `OUTLOOK_NOTIFICATION_MAILBOX` | Alamat pengirim organisasi |
| `ENABLE_OUTLOOK_EMAIL` | Gerbang utama pengiriman; default false |
| `VALIDA_MAIL_MODE` | disabled, test, atau live; live ditolak di lingkungan development/preview |
| `ENABLE_OUTLOOK_COMMERCIAL` | Gerbang terpisah email resmi ke pelanggan; default false |
| `ENABLE_EMAIL_REMINDERS` | Gerbang terpisah worker reminder; default false |
| `CRON_SECRET` | Rahasia acak minimal 32 karakter untuk endpoint cron |
| `SUPABASE_SECRET_KEY` | Worker server dari proyek Supabase yang sama dengan URL aplikasi |
| `APP_URL` | URL lingkungan untuk tautan pada reminder |

Selain gerbang server, reminder harus diizinkan oleh Super Admin per cabang.
Menyalakan checkbox cabang saja tidak mengaktifkan pengiriman jika mailbox atau
gerbang server belum lengkap. Mematikan checkbox membatalkan reminder yang
belum dikunci worker; email yang sudah diterima Microsoft tidak dapat ditarik
kembali melalui tombol pembatalan antrean.

## Urutan aktivasi dan UAT

1. Tinjau perubahan dan terapkan migrasi development, termasuk prasyarat
   portofolio sertifikat personil dari pengembangan sebelumnya. Migrasi email
   berada pada rentang `20261109165359` sampai `20261109220036` dan harus
   diterapkan berurutan. Tidak menyalin data produksi ke development.
2. Setelah alamat mailbox dan izin terbukti, lengkapi konfigurasi development.
   Gunakan mode **test**, gerbang utama true, commercial tetap false, dan
   reminder tetap false pada uji kirim manual pertama.
3. Login Admin, buka pratinjau satu sertifikat, pastikan tujuan uji Adli, lalu
   konfirmasi pengiriman. Periksa Sent Items, inbox uji, isi, dan riwayat VALIDA.
4. Ulangi konfirmasi pesan yang sama dan pastikan tidak muncul kiriman ganda.
5. Izinkan reminder cabang dan gerbang reminder untuk pilot kecil. Panggil cron
   melalui mekanisme berotorisasi; jangan membagikan `CRON_SECRET`. Periksa
   maksimal tiga pesan uji dan pemetaan penerimanya. Matikan kembali bila perlu.
6. Lakukan UAT perubahan tanggal, personil nonaktif, sertifikat pengganti,
   pembatalan antrean, serta pemulihan kegagalan otorisasi. Jangan memakai data
   sertifikat resmi untuk simulasi perubahan.
7. Setelah pemilik proses menyetujui hasil, terapkan migrasi dan konfigurasi
   produksi, lakukan deployment, lalu aktifkan live secara bertahap. Validasi
   semua PIC resmi sebelum mengaktifkan gerbang commercial. Tidak ada tahapan
   pada daftar ini yang sudah dianggap selesai hanya karena kode tersedia.
8. Pantau antrean awal. Bila banyak data lama baru masuk monitoring, jalankan
   batch tertunda secara terkontrol dan cek log cron sampai backlog habis.

## Jika ada kesalahan

- **Dalam antrean:** Super Admin dapat membatalkan dengan alasan.
- **Gagal otorisasi atau throttling yang sudah ditolak penyedia:** perbaiki
  penyebab, lalu Super Admin dapat mengantrekan ulang dengan alasan.
- **Respons hilang/timeout/5xx atau worker berhenti saat mengirim:** status
  menjadi Perlu pemeriksaan. Tidak ada retry otomatis; periksa Sent Items atau
  Message Trace bersama IT untuk mencegah email ganda. Claim lama direkonsiliasi
  setelah 15 menit pada pemanggilan worker berikutnya.
- **Graph 429:** ikuti Retry-After, maksimal tiga percobaan. Ini tidak berarti
  proses harus dipanggil terus-menerus secara manual.
- **Diterima Microsoft 365:** bukti penerimaan penyedia disimpan bersama request
  ID. Jangan menyebutnya delivered sampai ada bukti penerimaan tujuan.
- **Salah isi setelah terkirim:** email tidak dapat di-undo oleh VALIDA.
  Kirim klarifikasi melalui prosedur organisasi; riwayat pengiriman tetap ada.
- Penghapusan histori sertifikat tidak menghapus audit pengiriman email.
  Koreksi data sumber membatalkan antrean yang belum dikirim; pesan yang telah
  dikirim tetap menjadi catatan aktivitas nyata.

## Batas tahap ini

Pesan dikirim sebagai HTML dari template koordinasi, tanpa lampiran penawaran.
Belum ada delivery/bounce tracking otomatis, pengiriman dari mailbox pribadi AM,
pengingat ke PIC pelanggan secara otomatis, atau pengiriman ulang email accepted
yang identik. Draf Outlook tetap dapat dipakai untuk tindak lanjut manual.

## Bukti pengujian

Validasi 10 November 2026: 270 tes aplikasi lulus, typecheck dan lint perubahan
lulus, build produksi dengan Webpack lulus. Uji SQL development lulus dan tidak
meninggalkan cabang maupun antrean fixture. Uji hak eksekusi memastikan browser
tidak dapat memanggil fungsi antrean pesan, sedangkan worker server dapat.

Uji otomatis memakai transport tiruan; uji database memakai fixture sintetis
dalam transaksi yang di-rollback. Tidak ada email nyata, credential Microsoft
nyata, perubahan status personil produksi, atau pengaktifan jadwal produksi.
Uji browser mencakup desktop/ponsel, batal tanpa pengiriman, konfirmasi eksplisit,
fingerprint pratinjau, serta penonaktifan tombol kirim ulang pada hasil tercatat.

Security Advisor tetap menandai endpoint `configure_email_reminders` dan
`manage_email_delivery` sebagai fungsi SECURITY DEFINER yang callable oleh akun
authenticated. Keduanya sengaja merupakan endpoint administrasi: pemeriksaan
Super Admin/cabang berjalan di database dan telah diuji menolak akun tanpa hak.
Worker/antrean pesan hanya dapat dieksekusi service role. Fungsi tersebut tidak
memberi hak pengiriman kepada pengguna yang belum berwenang.

Rujukan resmi:

- [Microsoft Graph sendMail dan arti 202 Accepted](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0)
- [Exchange Online Application RBAC dan batas mailbox](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac)
- [Microsoft identity client credentials flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow)
- [Pengamanan dan pengelolaan Vercel Cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
