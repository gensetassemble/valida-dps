# Keamanan akun dan pemisahan lingkungan

Administrator dan Super Admin wajib memverifikasi authenticator (MFA/AAL2) sebelum mengakses aplikasi. Pengelolaan profil login dan penugasan peran hanya tersedia untuk Super Admin. HRGA tetap mengelola Direktori Pegawai sesuai kewenangan yang telah disetujui, tanpa memperoleh kewenangan mengatur akun atau peran.

## Masuk pertama setelah pembaruan

1. Masuk menggunakan akun resmi organisasi.
2. Pada halaman `/mfa`, pilih **Siapkan authenticator**.
3. Pindai QR menggunakan aplikasi authenticator pribadi. Jangan mengirim QR atau kode ke chat.
4. Masukkan kode enam angka, lalu lanjutkan ke dashboard. Login berikutnya meminta kode dari authenticator yang sama.
5. Aktifkan cadangan aman pada authenticator sesuai kebijakan organisasi. Jangan menaruh rahasia TOTP dalam repositori atau dokumen bersama.

## Perangkat authenticator hilang

Password atau tautan pemulihan password tidak menghapus MFA. Hubungi pengelola Supabase organisasi melalui saluran resmi. Pengelola harus memverifikasi identitas dan kewenangan pemohon secara terpisah, mencatat persetujuan serta waktu insiden, mencabut sesi akun, lalu menghapus faktor yang hilang melalui Auth Admin yang terotorisasi. Pengguna kemudian mendaftarkan authenticator baru sendiri. Jangan menerima permintaan reset hanya berdasarkan email atau pesan yang mengaku sebagai pemilik akun. Jika semua Super Admin kehilangan perangkat, pemilik proyek Supabase organisasi melakukan pemulihan ini; tidak ada tombol bypass MFA pada aplikasi.

## Password

- Password minimal 12 karakter.
- Perubahan dari menu Profil meminta password saat ini; Supabase juga mewajibkannya.
- Form pemulihan menerima sesi recovery yang diterbitkan Auth, terikat ke pengguna dan session ID, berumur maksimal 15 menit. Cookie penanda redirect tidak menjadi bukti recovery.
- Selesai pemulihan, semua sesi pengguna dikeluarkan. Pengguna login ulang, termasuk MFA bila memiliki peran administrator.
- Pendaftaran publik dan akun anonim dinonaktifkan. Proteksi kata sandi bocor layanan Supabase memerlukan paket berbayar dan tidak diaktifkan pada paket Free.

## Lingkungan

| Lingkungan | Proyek Supabase | Data |
| --- | --- | --- |
| Production (`VERCEL_ENV=production`) | `vzxmnkmvcbzxrkzdtxuy` | Data operasional yang sudah digunakan domain resmi |
| Development | `qjxwohmaqxdemlkkwdus` | Skema terpisah; tanpa salinan pegawai atau sertifikat production |

Nama proyek operasional yang lama masih mengandung `dev`; identitas lingkungan ditentukan oleh project ref dan konfigurasi runtime, bukan namanya. Aplikasi menolak target production ketika berjalan sebagai development/preview, serta menolak target development pada production. Impor melalui aplikasi hanya diizinkan di development.

Workspace memakai `.env.local` development. Jangan menyalin kunci admin production ke workspace development. Variabel server rahasia hanya disediakan pada lingkungan yang memerlukannya; tidak menggunakan awalan `NEXT_PUBLIC_`. Preview Vercel harus diberi URL/key development sendiri dan dibangun ulang; konfigurasi preview yang masih menunjuk production sengaja ditolak.

## Pelepasan dan pengujian

Terapkan migrasi `20261103093927_security_privileged_roles_mfa.sql` di development dahulu, jalankan pengujian RLS dan recovery, kemudian deploy aplikasi dan terapkan migrasi production dalam jendela pemeliharaan yang sama. Tanpa halaman `/mfa` yang sudah terdeploy, pengguna administrator AAL1 akan kehilangan akses sementara.

Uji autentikasi memakai identitas sintetis `.invalid` hanya di development, tanpa mengirim email dan tanpa mengubah password pengguna nyata. Akun, sesi, flow recovery, dan faktor uji dibersihkan sesudah pengujian. Jangan menjalankan fixture pada production. Uji SQL menggunakan transaksi rollback; fixture positif administrator menyatakan AAL2, sementara uji keamanan khusus memeriksa penolakan AAL1, Admin biasa, self grant, dan akses lintas cabang.

Akun `[CONTOH]` yang dinonaktifkan tidak boleh dipakai sebagai akses darurat. Simpan riwayat/audit yang sudah mereferensikan akun lama; jangan menghapus referensi operasional untuk membersihkan login.
