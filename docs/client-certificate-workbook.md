# Arsip sertifikat klien

Impor XLSX mengenali baris judul `Nama Pelanggan` dan `Nomor Sertifikat` dalam sepuluh baris pertama. Nilai sumber tetap disimpan pada staging; pelanggan, jenis sertifikat, portofolio, dan wilayah harus dipetakan sebelum impor aplikasi disetujui. Arsip bertambah secara bertahap; jumlah yang tercatat tidak mewakili seluruh sertifikat cabang.

Interval memakai satu satuan: hari atau bulan. Misalnya 56 hari dihitung sebagai 56 hari kalender, sedangkan interval bulan mengikuti kalender. Tanggal akhir eksplisit dari dokumen dipertahankan. Nomor seri, nomor sertifikat, dan SPK tetap berupa teks.

Kontak internal untuk pengujian ditandai `is_test` dan nama `[UJI]`. Kontak ini bukan bukti identitas PIC perusahaan. Draft Outlook berlabel `[UJI]`; membuka draft tidak mengirim email. Sebelum penggunaan operasional, ganti kontak uji dengan PIC perusahaan yang telah diperiksa.

Sertifikat terkini ditampilkan secara default. Sertifikat pengganti dapat menautkan versi sebelumnya, yang tersedia pada tampilan semua versi. Data contoh dikeluarkan dari daftar operasional; riwayat dan relasinya tetap tersimpan. Akses pelanggan tetap mengikuti penugasan AM dan RLS cabang.

Ekspor mengikuti filter dan akses pengguna, dengan portofolio, identitas pelanggan, objek, wilayah, tanggal, interval, nilai kontrak, SPK, PIC, AM, dan status masa berlaku. Dokumen PDF sertifikat tetap perlu dilampirkan secara terpisah; impor metadata tidak memverifikasi dokumen tersebut.
