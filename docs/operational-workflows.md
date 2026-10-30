# Workflow operasional — Prompt 05

Implementasi menambah proses ke data yang sudah ada. Status proses tidak mengganti status masa berlaku atau kelayakan. Seluruh transisi diperiksa di database serta tindakan server; akun memakai sesi Supabase pengguna dan tidak memakai service role untuk workflow.

## Permintaan kalibrasi

Koordinator pada portofolio yang ditugaskan dapat membuat permintaan tanpa hak mengubah alat atau sertifikat. Alur: Draf → Menunggu Tanda Tangan → Diajukan ke PTK → Diterima PTK → Selesai. PTK dapat mengembalikan dokumen untuk diperbaiki; pembatalan dan seluruh transisi dicatat. Satu permintaan aktif per alat. Penyelesaian memerlukan peristiwa kalibrasi baru pada alat yang sama dengan nomor sertifikat, tanggal akhir dan hasil.

Form cetak mempertahankan bagian A, B dan blok tanda tangan dari FOR/SCI-UMA/197 Rev. 02. Nilai yang belum diketahui tetap kosong. Pengaju mencetak, mendapatkan tanda tangan pengaju dan pejabat mengetahui, mengunggah PDF privat, lalu menyatakan kedua tanda tangan tersedia. Pernyataan ini bukan verifikasi tanda tangan digital; PTK memeriksa PDF sebelum menerima. Tidak ada IWO, SIMLab, pengadaan, atau alokasi biaya laboratorium.

## Penanggung jawab

Master Penetapan Koordinator menautkan satu kontak koordinator utama ke portofolio pada periode efektif. Identitas pegawai dapat ditautkan setelah dipastikan dari master 132 pegawai. Kontak bisnis dan penetapan tanggung jawab tidak membuat akun atau memberikan cakupan akses; akses tetap memerlukan penugasan peran serta portofolio yang sah.

Alat baru mengambil penetapan aktif di server. Tanpa penetapan, tidak dipilih pegawai secara acak. Alat lama tidak diubah massal; snapshot tanggung jawab tetap. Pengalihan oleh administrator memerlukan alasan dan audit. Penetapan lama ditutup, bukan diganti identitasnya. Periode aktif bertumpang tindih ditolak.

## Perpanjangan personil

HRGA/admin: Belum Diproses → Sedang Diproses → Sudah Diperpanjang. Sertifikat pengganti harus milik pegawai, cabang dan jenis kompetensi yang sama, lengkap nomor/tanggal/bukti PDF atau referensi folder, serta masa berlaku baru. Sertifikat lama tidak ditimpa. Sertifikat seumur hidup tidak masuk proses berkala. Koreksi administratif terhadap proses yang sudah ditutup memerlukan pengembangan tindakan terpisah, bukan mengedit riwayat.

Perubahan status menghasilkan event dan notifikasi internal unik per penerima/event. Pemilik dikenali melalui profiles.employee_id. Bila akun aktif yang dapat mengakses sertifikat belum tersedia, log proses menampilkan bahwa pengiriman kepada pemilik belum tersedia. Tidak ada pencocokan penerima menggunakan nama saja. Email Microsoft 365 serta reminder H-90/H-60/H-30/H-0 tetap terpisah dan tidak diaktifkan oleh fitur ini.

## Data, UI, dan validasi

Migrasi bersifat tambahan, RLS aktif, dokumen privat dengan URL bertenggat 60 detik. Request dan case memakai version untuk menolak penyimpanan dari formulir yang sudah kedaluwarsa. Event bersifat append-only melalui trigger; notifikasi dapat ditandai dibaca oleh penerima saja.

Form alat menggunakan pasangan parameter/isian yang rapat dan berkelompok, dua pasangan per baris desktop dan menumpuk di ponsel. Filter kategoris berada dalam tombol popover yang dapat dicari; rentang tanggal tetap berupa popover tanggal. Filter hanya di halaman utama; daftar kompetensi di pop-up pegawai menampilkan seluruh sertifikat miliknya tanpa filter bawaan dari halaman sebelumnya.

Audit pegawai mengacu pada workbook 132 orang. Tidak ada penggabungan atau penghapusan otomatis. Usulan kapitalisasi terpisah dari koreksi ejaan/identitas; NPP dan relasi tetap.

## Pembaruan matriks akun dan identitas

Matriks akses terbaru memuat 27 baris yang menjadi 26 akun unik; dua penugasan koordinator memakai satu email. PTK dan QSHE mencakup sepuluh portofolio DPS sesuai persetujuan pengguna. Gabungan role kepala bidang dan AM memberi baca seluruh DPS tetapi tetap menulis hanya pelanggan yang ditugaskan; tombol tulis per baris mengikuti kepemilikan tersebut.

Login tidak memerlukan aktivasi/verifikasi identitas pegawai. Akun dan grant peran tetap dapat dinonaktifkan/dicabut. Akun contoh non-Super-Admin dihapus melalui Auth Admin API setelah aksesnya dicabut; profilnya diarsipkan agar audit dan relasi bisnis bertahan. Kredensial serta daftar identitas akun tidak disimpan dalam Git.

Penggabungan pegawai dilakukan hanya setelah konfirmasi identitas tertentu. Rekaman sumber tetap tersimpan dengan tautan alias ke identitas utama, direktori menampilkan identitas utama, dan tautan lama diarahkan ke identitas utama. Sertifikat lama, nomor/tanggal, bukti sumber, serta penugasan historis tidak dihapus. Koreksi kapitalisasi massal dan pengalihan pelanggan tetap menunggu persetujuan terpisah bila ditunda pengguna.

Catatan operasional ditampilkan pada halaman, formulir dan ekspor. Diagnostik impor (baris Excel, staging, kandidat aset) tidak ditampilkan; menyimpan formulir tetap mempertahankan komponen diagnostik yang sudah ada sebagai provenance.

## Preview dan PDF permintaan kalibrasi

Setelah Simpan draf, formulir tetap terbuka dan menyediakan Preview formulir serta Unduh PDF. Preview besar menampilkan PDF yang sama dengan berkas unduhan, memakai template FOR/SCI-UMA/197 Rev.02 yang diberikan pengguna. Setelah isian diubah, simpan kembali untuk memperbarui preview dan unduhan. Tombol juga tersedia pada riwayat permintaan, termasuk permintaan yang sudah ditutup. Nilai diambil dari draf yang dibaca melalui sesi pengguna dan RLS; respons PDF privat, tidak dicache. Isian panjang dipindahkan ke lampiran, bukan dipotong. Nama tercetak tidak menggantikan tanda tangan pengaju/Kabid atau gate dokumen bertanda tangan.

Pada formulir alat, Rentang ukur / kapasitas menyediakan simbol SI, satuan yang diterima bersama SI, simbol historis yang dapat dibaca pengguna, serta Satuan lain. Simbol mengikuti kapitalisasi BIPM; satuan historis non-SI dipisahkan dan tidak dikonversi otomatis. Teks sumber kompleks tetap utuh sampai diedit. Nilai dan satuan disimpan bersama pada kolom range yang sudah ada, sehingga tabel monitoring, ekspor, dan PDF tetap konsisten. Spesifikasi tambahan digunakan untuk dimensi/keterangan di luar rentang; isian sumber lama tidak digabung atau ditulis ulang otomatis.

## Pengelolaan status personil oleh HRGA

Pada Master Data → Direktori Pegawai, HRGA/admin memilih **Status personil**. Pilih Nonaktif beserta alasan Resign/Pindah/Lainnya, tanggal efektif hari ini atau sebelumnya (WITA), dan keterangan minimal delapan karakter. Pengaktifan kembali memakai alasan Aktif kembali. Tanggal tidak boleh mendahului keputusan terakhir; penjadwalan masa depan belum tersedia. Setiap keputusan tercatat dalam riwayat yang tidak dapat ditulis langsung atau dihapus melalui aplikasi. Perubahan status sendiri memerlukan administrator lain.

Status kepegawaian terpisah dari aktivasi/verifikasi direktori lama. Nilai lama `is_active=false` atau `employment_status=unknown` tidak membatalkan login yang sudah disetujui. Keputusan eksplisit Nonaktif menghentikan akses aplikasi melalui RLS, termasuk sesi yang masih memiliki JWT. Akun dan penugasan tidak dihapus; pengaktifan kembali tetap memerlukan akun serta grant yang sah. Sertifikat, tanggal, NPP, dan relasi alat tetap tersimpan. Personil Nonaktif tidak ditawarkan untuk pencatatan operasional baru; referensi historis tetap terlihat. Tidak ada pegawai yang dinonaktifkan oleh migrasi fitur ini.

Pada detail kompetensi, tiga tahap perpanjangan terlihat langsung. HRGA membuka proses, mencatat pengajuan saat Sedang Diproses, lalu memilih **Catat sertifikat terbaru**. Formulir meminta nomor baru, penerbit, tanggal terbit, interval/tanggal akhir, folder bukti Google Drive, dan catatan. Tanggal akhir dapat dihitung otomatis dari tanggal terbit + interval. Penyimpanan membuat generasi sertifikat baru dan menyelesaikan proses dalam satu transaksi; kegagalan gate tidak meninggalkan sertifikat setengah tersimpan. Alternatifnya, HRGA dapat menautkan sertifikat pengganti yang sudah dicatat dan dilengkapi PDF/folder melalui **Kelola proses**. Sertifikat lama tidak ditimpa. Personil Nonaktif tidak dapat melanjutkan tahap renewal, tetapi riwayat tetap dapat dibaca HRGA.
