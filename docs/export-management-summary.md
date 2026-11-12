# Ringkasan manajemen dalam ekspor Excel

Ekspor Sertifikat Klien, Kompetensi Personil, dan Kalibrasi Alat membuka tab pertama **Ringkasan Manajemen**. Tab laporan detail tetap tersedia setelahnya; format FOR/SCI-UMA/198 dipertahankan.

Ringkasan berisi total rekaman, jumlah Expired + Kritis, jumlah yang berakhir dalam 0–90 hari, tabel jumlah/persentase setiap status, dan grafik batang Excel yang dapat diedit. Sheet disiapkan untuk cetak A4 landscape satu halaman.

## Dasar hitungan

- Hanya rekaman yang benar-benar diekspor, mengikuti filter dan hak akses akun.
- Kompetensi mengikuti pilihan menyertakan personil nonaktif; default mengecualikannya.
- Satu alat dihitung sekali walaupun memiliki beberapa parameter atau faktor koreksi.
- Sertifikat dihitung per rekaman/versi yang masuk ekspor, bukan jumlah unik pegawai atau pelanggan.
- Status dihitung ulang pada satu tanggal acuan WITA: Expired <0 hari; Kritis 0–30; Perhatian 31–60; Pantau 61–90; Aman >90.
- Tanggal belum diisi dan Berlaku Seumur Hidup tetap dihitung terpisah agar total cocok.
- Angka/grafik adalah snapshot saat ekspor, bukan koneksi langsung ke database. Ekspor ulang untuk data terbaru.

Grafik menggunakan bagian OOXML native dan referensi ke tabel ringkasan. Penyisipan dilakukan setelah pemformatan laporan, tanpa menyimpan ulang template kalibrasi melalui parser yang dapat mengubah layout atau gambar.

## Validasi

`tests/management-summary.test.ts` memeriksa batas hari, total/persentase, data kosong, hitungan alat dengan banyak faktor, ketiga format ekspor, referensi grafik, dan pelestarian sheet/detail/gambar asli. Hasil uji juga dibuka di Microsoft Excel untuk memeriksa grafik dan layout.
