# Pembuatan akun massal tanpa email

Tersedia untuk Super Admin cabang dengan MFA melalui **Pengaturan → Pengguna → Impor akun massal**.

1. Unduh template XLSX dan isi sheet **Pengguna**: Nama, NPP, Email, Peran. NPP wajib format Teks agar nol di depan tetap utuh. Non-NPP dikosongkan, namanya harus cocok dengan satu identitas direktori. Jangan memasukkan password ke file.
2. Isi email login secara manual. Peran memakai kode/label yang tersedia; beberapa peran dipisahkan `|`. Koordinator harus sudah memiliki penugasan portofolio aktif. Impor ini tidak mengubah penugasan portofolio.
3. Unggah CSV/XLSX, maksimal 512 KB dan 100 pegawai. File diproses di browser, kemudian hanya baris identitas/peran yang dikirim untuk pencocokan server. Formula dan workbook berpassword tidak diterima.
4. Periksa pratinjau. Identitas ambigu/nonaktif, NPP yang tidak cocok, atau pegawai/email berulang ditolak. Email yang sudah memiliki profil dilewati tanpa mengubah akun/password/perannya. Pegawai yang sudah terhubung ke akun berbeda harus dikelola melalui profil lama.
5. Centang persetujuan, termasuk persetujuan tambahan bila ada akun Admin/Super Admin, lalu jalankan pembuatan. Akun diproses satu per satu. Tombol berhenti menyelesaikan baris yang sedang berjalan, lalu menghentikan baris berikutnya. Pratinjau berlaku 15 menit dan terikat pada sesi Admin serta cabang.
6. Unduh laporan hasil. Password tidak dicantumkan dalam laporan. Bila koneksi terputus, buat pratinjau baru untuk memeriksa hasil tersimpan; akun lama tetap tidak ditimpa. Pesan yang meminta pemeriksaan IT berarti status transaksi belum pasti dan tidak boleh ditangani dengan menghapus akun sembarangan.
7. Admin membagikan akses dan password awal melalui proses internal. Tidak ada email konfirmasi, undangan, atau sinkronisasi Microsoft 365 yang dijalankan fitur ini. Alamat email digunakan sebagai identitas login.

Password awal mengikuti konfigurasi Admin pada server (`BULK_USER_INITIAL_PASSWORD`). Nilainya tidak ditulis dalam kode browser, GitHub, template, laporan, atau log. Pratinjau ditandatangani dengan `BULK_USER_REVIEW_SECRET` yang terpisah dari password awal.

## Login pertama

Pengguna masuk memakai email dan password awal, kemudian diarahkan ke **Ganti password awal**. Mereka mengisi password saat ini, password pribadi baru, dan konfirmasi. Setelah berhasil mereka masuk kembali. MFA Admin/Super Admin tetap diwajibkan.

Pembatasan ini berlaku di database, bukan hanya pengalihan halaman. Penanda disimpan di skema privat dan hanya perubahan password yang dikonfirmasi Auth yang menghapusnya; metadata pengguna dan tombol browser tidak dapat membuka akses. Akun lama yang tidak dibuat melalui fitur bulk tidak dipaksa mengganti password.

## Batas dan penanganan kegagalan

Profil, peran, aktivasi, dan penanda password awal disimpan dalam satu transaksi database dengan otorisasi sesi Admin dan audit yang sudah ada. Login Auth baru dibersihkan bila transaksi gagal dan ketiadaan profil dapat dipastikan. Jika respons terputus setelah transaksi mungkin tersimpan, login dipertahankan untuk pemeriksaan IT. Akun Auth yang sudah ada tidak di-reset atau diambil alih melalui impor.

Belum ada akun pegawai yang dibuat otomatis oleh pengembangan ini. Pembuatan hanya berjalan setelah Super Admin mengunggah dan menyetujui file melalui aplikasi.
