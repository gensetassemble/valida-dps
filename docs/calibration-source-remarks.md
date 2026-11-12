# Keterangan sumber laporan kalibrasi

Perbaikan 12 November 2026 mengembalikan keterangan operasional dari workbook impor ke alat dan peristiwa kalibrasi. Sebelumnya keterangan tersimpan dalam arsip baris impor, tetapi catatan alat/peristiwa hanya berisi diagnostik impor sehingga kolom Keterangan pada ekspor kosong.

## Pemeriksaan dan pemulihan

- 181 peristiwa impor dicocokkan ke lembar/baris workbook `List Alat Kalibrasi 7 Portfolio.xlsx`. Seluruh keterangan cocok dengan snapshot sumber impor.
- 79 alat/peristiwa memiliki keterangan sumber yang tidak kosong. Keterangan tersebut dipulihkan verbatim; sumber yang kosong tetap kosong.
- Pencocokan menggunakan ID peristiwa, ID alat, relasi baris impor, serta hash workbook impor. Tag alat saja tidak cukup karena ada tag berulang pada alat berbeda.
- Catatan sebelumnya dipertahankan. Pembaruan hanya menyentuh catatan beserta metadata pembaruan; tanggal, hasil, parameter, dan penugasan tidak berubah. Audit menyimpan 79 perubahan alat dan 79 perubahan peristiwa.
- Keterangan ini mencerminkan catatan pada sumber impor, bukan pemeriksaan kondisi terbaru.

## Perilaku aplikasi

Normalisasi impor memprioritaskan `notes`, `Catatan`, `KeteranganAsli`, lalu `Keterangan`. `CatatanValidasi` tidak menjadi catatan operasional.

Ekspor monitoring menggabungkan catatan alat dan catatan peristiwa kalibrasi terakhir yang dapat diakses pengguna pada cabangnya. Potongan identik tidak diulang. Diagnostik teknis tetap disimpan sebagai provenance dan disaring dari laporan melalui `businessNotes`. Jika pembacaan catatan gagal, ekspor menampilkan kesalahan agar tidak menghasilkan laporan dengan catatan yang diam-diam kosong.

## Verifikasi

Tes mencakup prioritas sumber, pemisahan diagnostik, sel Keterangan XLSX, penggabungan tanpa duplikasi, batas cabang, dan kegagalan pembacaan. Pemeriksaan lokal tambahan membandingkan seluruh 79 catatan yang dipulihkan dengan sel ekspor per portofolio. Artefak audit berisi data internal dan disimpan di `.tools/calibration-notes-audit`, tidak dimasukkan ke Git.
