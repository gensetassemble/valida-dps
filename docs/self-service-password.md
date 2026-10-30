# Ganti password akun sendiri

Semua pengguna aktif dapat membuka nama akun di kanan atas → Profil Saya → Ganti password. Form meminta password saat ini, password baru minimal 12 karakter, dan konfirmasi. Password baru harus berbeda dari password saat ini. Setelah berhasil pengguna kembali ke login dengan pemberitahuan bahwa password diperbarui.

Server memeriksa pengguna aktif dan memanggil Supabase Auth `updateUser` menggunakan sesi pengguna tersebut beserta `current_password`. Tidak ada parameter ID/email sasaran, penugasan peran tambahan, atau kebutuhan `SUPABASE_SECRET_KEY`. Password tidak disimpan pada tabel profil maupun audit aplikasi. Sesi lokal dan seluruh chunk cookie Auth dibersihkan setelah pembaruan berhasil. Bila Supabase meminta autentikasi ulang, pengguna diminta logout dan login kembali sebelum mengulangi penggantian.

Validasi dan otorisasi diperiksa dengan unit test untuk seluruh peran, termasuk Tester. Penolakan Auth, kegagalan jaringan, dan kebutuhan autentikasi ulang diperiksa menggunakan mock. Build, lint, dan tampilan form di browser diperiksa. Password akun yang sudah tersedia tidak diganti selama pemeriksaan browser; pengujian penyimpanan password nyata tetap dilakukan oleh pengguna melalui form.
