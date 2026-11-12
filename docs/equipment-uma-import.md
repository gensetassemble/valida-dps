# Sinkronisasi massal Excel/CSV PTK

Di halaman **Kalibrasi Alat**, Admin, PTK, dan Koordinator yang memiliki hak ubah dapat memilih **Impor Excel / CSV**. Hak cabang dan portofolio yang sudah berlaku tetap diperiksa database. Pengguna baca saja tidak dapat menjalankan impor.

1. Gunakan laporan monitoring **FOR/SCI-UMA/198**, termasuk file XLSX hasil ekspor VALIDA. Kolom tetap mengikuti UMA; tidak perlu menambah ID internal.
2. Unggah XLSX atau CSV UTF-8 (koma atau titik koma), maksimum 4 MiB dan 250 baris alat/peristiwa. XLS lama perlu disimpan sebagai XLSX. File lebih besar dibagi per portofolio.
3. Portofolio dibaca dari kolom Portofolio, nama sheet, atau pilihan portofolio file jika tidak tercantum. Workbook multi-portofolio didukung. Sheet ringkasan, revisi/arsip, tersembunyi, dan sheet bukan UMA diabaikan dan disebutkan pada hasil.
4. Klik **Impor & Perbarui**. Tidak ada persetujuan per baris. Jika seluruh baris valid, perubahan langsung diterapkan. Bila ada kesalahan, transaksi seluruh file dibatalkan dan letak masalah ditampilkan (maksimum 100).
5. Periksa ringkasan alat baru, alat diperbarui, peristiwa baru, dan data tetap. Halaman monitoring diperbarui setelah impor berhasil.

## Kolom dan aturan

Nama Barang, Tag-Number, dan portofolio wajib untuk pencocokan. Nomor seri memperjelas identitas. Tag berulang tidak dipakai sendirian untuk mencocokkan alat. Alat ambigu, nomor seri berbeda, dan alat arsip ditahan untuk koreksi; impor tidak memulihkan arsip atau menghapus alat yang tidak ada dalam file.

Kolom spesifikasi, kondisi, status barang, subunit pemilik, lembaga kalibrasi, keterangan, tanggal, interval, jenis kalibrasi, signifikan, rentang ukur, dan faktor koreksi dibaca sesuai UMA. Lokasi dan hasil kalibrasi dapat ditambahkan sebagai kolom opsional. Interval dibaca dalam bulan atau tahun; angka tanpa satuan berarti bulan. Tanggal memakai tanggal Excel, ISO, dd/mm/yyyy, atau nama bulan Indonesia/Inggris. N/A/strip pada tanggal berarti tidak tercatat. Cell kosong mempertahankan nilai sebelumnya, bukan menghapusnya. Untuk menghapus catatan, isi `[KOSONGKAN]` pada Keterangan.

Rentang ukur dan kelompok faktor koreksi pada XLSX mengikuti cell gabungan; satu alat tetap satu alat. CSV menggunakan satu baris per alat, dengan faktor koreksi multiline dalam satu cell untuk satu rentang ukur. Untuk beberapa pasangan rentang/koreksi, gunakan XLSX UMA.

Beberapa blok ukur dengan identitas alat dan sertifikat yang sama digabungkan menjadi satu peristiwa. Jika satu alat memiliki beberapa nomor sertifikat pada tanggal terbit yang sama, setiap nomor tetap menjadi peristiwa tersendiri tanpa menggandakan alat. Tanda Internal dan Eksternal yang sama-sama dicentang perlu dikoreksi pada file terlebih dahulu.

## Peristiwa kalibrasi

- Nomor sertifikat sama pada alat yang sama: peristiwa diperbarui, tidak diduplikasi.
- Nomor sertifikat baru: buat peristiwa baru; tanggal terbit wajib. Peristiwa lama tetap tersimpan.
- Tanpa nomor sertifikat, tanggal terbit digunakan untuk mencari peristiwa. Jika hanya mengubah keterangan/status alat, peristiwa terbaru yang dipakai.
- File yang menunjuk sertifikat historis atau menambahkan peristiwa lebih lama dari sertifikat terbaru ditolak agar file lama tidak menimpa monitoring terbaru.
- Tanggal berakhir dari file digunakan jika diisi. Jika hanya tanggal terbit/interval diperbarui, tanggal berakhir dihitung ulang. Hasil kalibrasi baru mengikuti default Layak yang sudah ditetapkan aplikasi, kecuali file menyebut Tidak layak.
- Perubahan isi kalibrasi tidak otomatis menjadi verifikasi dokumen. Audit perubahan alat dan kalibrasi tetap dicatat dengan akun pengimpor.

## Riwayat dan pembatalan

Setiap impor berhasil menyimpan nama/hash file, lembar/baris dan nilai sumber, akun, serta waktu pada `equipment_sync_runs`. Audit tabel bisnis menyimpan nilai sebelum/sesudah. Unggah ulang file yang sama tidak membuat peristiwa ganda. Tidak ada tombol undo massal pada versi ini; koreksi dapat dilakukan dengan mengimpor file koreksi terbaru. Pembatalan pengajuan UMA berbeda dari pembaruan data monitoring dan tidak dijalankan oleh impor ini. Tidak ada email yang dikirim oleh proses impor.
