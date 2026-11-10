# Direktori, profil pengguna, dan arsip notifikasi

Rilis `2026.11.10-personnel-directory-inbox.1`.

- Nama pegawai dan jabatan disajikan dengan awal kata kapital pada daftar, detail, filter pegawai, matriks, dan pilihan profil. NPP tetap teks, nol di depan dipertahankan, sumber asli tidak ditimpa massal.
- Tambah peristiwa kalibrasi hanya berada pada kartu Riwayat Kalibrasi.
- Log proses menampilkan nama petugas yang dapat diakses atau “Petugas berwenang”, bukan UUID. Hash sumber tetap tersimpan di audit tetapi tidak muncul dalam keterangan pengguna.
- Super Admin dapat memilih pegawai dari direktori ketika membuat/mengubah profil. Nama dan NPP mengikuti direktori; email diisi manual. Identitas dipastikan kembali di server/RPC menggunakan ID pegawai dan cabang, termasuk Non-NPP. Memilih pegawai tidak otomatis membuat akun, mengaktifkan pegawai, atau memberikan peran.
- Penugasan Peran tampil sebelum katalog peran.
- Badge masa berlaku dapat membungkus agar Seumur Hidup tidak tertutup kolom beku.

## Arsip pribadi

Notifikasi tidak mempunyai jadwal penghapusan otomatis. Tombol **Arsipkan** memindahkan aktivitas yang tampil pada kartu ke folder **Arsip** untuk akun tersebut. Badge belum dibaca menghitung inbox saja. **Kembalikan ke inbox** memulihkan aktivitas dengan status bacanya semula. Tidak ada penghapusan audit dan tidak mengubah proses maupun inbox pengguna lain.

Filter **Perlu tindak lanjut** mengecualikan proses berstatus selesai/dibatalkan/sudah diperpanjang. Notifikasi baru dari proses yang sama tetap masuk inbox. Pengarsipan sistem akibat penghapusan histori proses tetap mengikuti aturan lama dan tidak dapat dipulihkan melalui arsip pribadi.

## Email pemilik sertifikat

Notifikasi proses saat ini berupa pemberitahuan di aplikasi kepada pemilik yang mempunyai akun aktif dan tertaut ke pegawai yang benar. Pesan pada histori menjelaskan kondisi penerima saat event dicatat; bukan bukti pengiriman email. Email otomatis belum diaktifkan. Pengirim mailbox organisasi, konfigurasi Microsoft Entra/Graph, persetujuan admin tenant dan uji penerima internal perlu diselesaikan sebelum pengiriman resmi. Jangan menggunakan daftar pegawai untuk menebak email.

## Rekomendasi onboarding bulk

Gunakan CSV/XLSX dengan nama, NPP (teks; kosong untuk Non-NPP), email, peran, cabang, dan portofolio bila diperlukan. File tidak berisi password. Alur yang disarankan: unggah → cocokkan Direktori Pegawai → laporan duplikat/identitas ambigu → pratinjau → konfirmasi Super Admin dengan MFA → undangan aktivasi melalui email organisasi → laporan berhasil/gagal per baris. Akun lama tidak ditimpa dan peran berisiko tidak diberikan tanpa review. Impor data bisnis yang ada bukan alat provisioning akun; impor bulk akun belum diaktifkan pada rilis ini.
