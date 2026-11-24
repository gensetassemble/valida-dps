# Lampiran PDF kompetensi

## Penggunaan

1. Setelah rekaman baru tersimpan, aplikasi membuka detailnya. Pada
   **Lampiran dokumen PDF**, pilih berkas lalu **Unggah PDF privat**.
2. PDF yang berhasil diunggah langsung membuka pratinjau. **Lihat PDF** dan
   **Tutup pratinjau** membuka/menutup tampilan; **Buka PDF** tersedia terpisah.
3. Pada detail alat, lampiran mengacu pada **hasil kalibrasi terbaru**.
   Lampiran hasil lama tetap dapat dibuka dari Riwayat Kalibrasi.

HRGA/Admin mengunggah sertifikat personil. PTK/Admin/Koordinator sesuai cakupan mengunggah PDF hasil
kalibrasi. Akses baca mengikuti RLS rekaman; bucket tetap privat. Pratinjau
memakai PDF.js dan endpoint sesi pengguna dengan `private, no-store`.
Unggah tidak mengubah tanggal atau menyelesaikan proses perpanjangan.

## Validasi dan rilis

Lakukan UAT unggah PDF nyata melalui sesi pengguna yang berwenang.
Belum tersedia tombol hapus lampiran; salah lampir perlu ditangani IT Officer.

Build Webpack berhasil. Turbopack pada host Windows ini gagal menjalankan
subprocess CSS; konfigurasi build proyek tidak diubah untuk menyamarkan kegagalan.
