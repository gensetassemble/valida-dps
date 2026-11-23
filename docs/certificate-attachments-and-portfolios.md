# Lampiran PDF dan portofolio kompetensi

Implementasi 9 November 2026. Migrasi sudah diuji pada Supabase development
`qjxwohmaqxdemlkkwdus`. Belum diterapkan pada produksi atau dirilis ke Vercel.

## Penggunaan

1. HRGA/Admin memilih **Portofolio penanggung jawab sertifikat** ketika menambah
   kompetensi. Penetapan ini milik lisensi tersebut, terpisah dari penempatan pegawai.
2. Setelah rekaman baru tersimpan, aplikasi membuka detailnya. Pada
   **Lampiran dokumen PDF**, pilih berkas lalu **Unggah PDF privat**.
3. PDF yang berhasil diunggah langsung membuka pratinjau. **Lihat PDF** dan
   **Tutup pratinjau** membuka/menutup tampilan; **Buka PDF** tersedia terpisah.
4. Pada detail alat, lampiran mengacu pada **hasil kalibrasi terbaru**.
   Lampiran hasil lama tetap dapat dibuka dari Riwayat Kalibrasi.

HRGA/Admin mengunggah sertifikat personil. PTK/Admin/Koordinator sesuai cakupan mengunggah PDF hasil
kalibrasi. Akses baca mengikuti RLS rekaman; bucket tetap privat. Pratinjau
memakai PDF.js dan endpoint sesi pengguna dengan `private, no-store`.
Unggah tidak mengubah tanggal atau menyelesaikan proses perpanjangan.

## Pemetaan dan ekspor

- Form mewajibkan pemilihan portofolio untuk sertifikat baru dan saat koreksi.
- HRGA/Admin dapat memperbaiki pemetaan sertifikat yang sudah ada, dengan audit.
- Filter, urutan portofolio, dan ekspor memakai penetapan per sertifikat.
- Sertifikat pengganti dari penyelesaian proses HRGA menyalin portofolio sumber.
- Data lama **tidak dipetakan otomatis** dari seluruh penempatan pegawai.
  Ekspor menandai sertifikat yang belum diperiksa dengan **Belum dipetakan**.
- Tidak ada impor ulang, merge pegawai, atau perubahan status pegawai.

## Validasi dan rilis

Migrasi:

- `20261109152027_personnel_certificate_responsible_portfolio.sql`
- `20261109152628_personnel_certificate_portfolio_edit.sql`

Uji transaksi development membuktikan HRGA dapat memetakan sertifikat yang ada,
view menampilkan portofolio itu, dan hasil perpanjangan menyalinnya. Semua
fixture dan notifikasi uji di-rollback. Uji lainnya menolak FK portofolio tidak
valid dan memastikan nilai kosong tidak ditebak dari penempatan pegawai.

Sebelum merilis aplikasi, terapkan kedua migrasi berurutan pada database tujuan.
Kemudian lakukan UAT unggah PDF nyata melalui sesi pengguna yang berwenang.
Belum tersedia tombol hapus lampiran; salah lampir perlu ditangani IT Officer.

Build Webpack berhasil. Turbopack pada host Windows ini gagal menjalankan
subprocess CSS; konfigurasi build proyek tidak diubah untuk menyamarkan kegagalan.
