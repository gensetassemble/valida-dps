# Impor monitoring dan pengingat prioritas

- Format impor: CSV, XLSX, XLS, dan XLSB. Maksimum unggahan 4 MiB; 250 baris alat/peristiwa setelah penggabungan. File lama dibaca di server; makro tidak dijalankan.
- Baris yang seluruh nilai alat dan peristiwanya identik dilewati. Hasil impor menampilkan jumlah duplikat tersebut. Blok rentang/faktor yang berbeda tetap digabung sebagai parameter; sertifikat katup berbeda tetap menjadi peristiwa terpisah pada satu alat.
- Impor ulang memakai pencocokan portofolio, tag, serial, dan sertifikat yang sama. Tidak menghapus alat yang tidak ada di file. Konflik nilai atau padanan ambigu membatalkan seluruh transaksi, bukan memilih data sembarang.
- Notifikasi menampilkan daftar prioritas dari data monitoring terkini: Expired (tanggal sudah lewat) dan Kritis (H-0 sampai H-30), dalam WITA. Hak akses cabang/modul/portofolio mengikuti sumber RLS yang sama dengan dashboard. Sertifikat personil yang sudah diganti tidak dimasukkan kembali.
- Daftar prioritas adalah kondisi aktif, bukan salinan event harian. Membaca atau mengarsipkan notifikasi proses tidak menyembunyikan alat/sertifikat yang masih urgent. Jumlah belum dibaca tetap menghitung pesan inbox; jumlah prioritas ditampilkan tersendiri.
- Nama dan alamat uji pratinjau/draft Outlook: [UJI] I Kadek Nicko Iswara Sudanta, kadek.nicko@sucofindo.co.id. Penggantian penerima uji tidak mengirim email dan tidak mengaktifkan pengiriman resmi.
