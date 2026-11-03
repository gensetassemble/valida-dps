# Pengajuan UMA per portofolio

Koordinator Operasional membuka **Kalibrasi Alat → Ajukan perbaikan / kalibrasi**, memilih satu portofolio dan 1–50 alat. Alat dengan pengajuan aktif tidak dapat dipilih lagi. Formulir yang dibuka dari detail alat memilih alat tersebut terlebih dahulu.

Isi nomor urut, pejabat mengetahui, tempat penandatanganan, lembaga, dan alasan pengajuan. Resolusi/kelas serta titik instrument reading dapat diisi per alat. Nama organisasi pada sertifikat dapat disesuaikan; alamat yang belum diketahui dapat dilengkapi manual di Excel.

Sistem menetapkan nomor `XXXX/DPS-BULANROMAWI/OPS-PORTOFOLIO/TAHUN`, unit `Cab Denpasar / PORTOFOLIO`, tanggal pengajuan WITA, nama pengaju dan NPP direktori. Kode resmi portofolio dipertahankan utuh, termasuk HMPM, AEBT dan SERCO. Pejabat dipilih hanya dari Fikri Haykal, Putu Angga Bujana dan Taufik Talentino yang memiliki akun/peran aktif pada cabang.

**Ajukan & unduh Excel** membuat satu pengajuan berstatus Sedang Diajukan dan mengirim notifikasi dalam aplikasi kepada PTK. Excel berisi formulir utama dari template UMA asli dan lembar Lampiran Alat. Biaya, hari kerja, serta tanda tangan dilanjutkan manual. Nama file mengikuti `Pengajuan Kalibrasi Alat PORTOFOLIO TAHUN.xlsx` (atau Perbaikan sesuai jenis permintaan).

PTK memakai **Mulai Proses** dan **Selesai** untuk seluruh bundel sekaligus. Pengajuan yang sama tampil dari setiap alat anggotanya; tidak ada progres terpisah per alat. Penyelesaian pengajuan tidak mengubah tanggal atau hasil kalibrasi. Hasil kalibrasi baru tetap dicatat setelah diterima.

Pembatalan mengikuti kewenangan pengaju/PTK/administrator yang sudah berlaku. Hapus histori hanya untuk IT Officer pada pengajuan tertutup. Histori dan notifikasi terkait diarsipkan, sedangkan audit serta data alat tetap tersimpan.

# Ekspor kompetensi personil

**Ekspor XLSX sesuai filter** mengecualikan pegawai berstatus Nonaktif atau direktori yang diarsipkan. Penanda aktivasi identitas lama tidak digunakan sebagai status kepegawaian. Status Belum Dikonfirmasi tetap disertakan dengan keterangan. **Ekspor termasuk personil nonaktif** menggunakan filter tabel yang sama, menyertakan pegawai nonaktif, memberi warna oranye pada barisnya, dan menambahkan status pada Keterangan. Nomor dan tanggal sertifikat tetap berasal dari data website saat ekspor.

# Validasi

`supabase/tests/uma_bundles.sql` menguji transaksi yang dibatalkan kembali: cakupan portofolio, daftar pejabat, anggota unik, konflik pengajuan, snapshot dari database, notifikasi PTK dan progres bersama. `supabase/tests/operational_workflows.sql` memeriksa regresi alur serta otorisasi yang sudah ada. Pengujian ekspor memeriksa template utama, lampiran landscape, titik ukur panjang, tanggal WITA dan pegawai nonaktif.
