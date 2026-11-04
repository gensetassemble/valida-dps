# Sertifikat klien: akses dan korespondensi

Tim AM cabang DPS dapat membaca, menambah, dan mengubah sertifikat seluruh pelanggan DPS, berikut bukti dokumen dan tindak lanjut perpanjangannya. Kabid PDOS saat ini, Novita Eka Anindia, telah mempunyai peran `department_head` dan `account_manager`; peran komersial tersebut memberi akses yang sama. Kabid lainnya, Kepala UP, dan Tester tetap hanya baca. Penggantian pejabat perlu meninjau penugasan peran akun penggantinya.

Penanggung jawab bisnis/AM yang tercatat pada pelanggan tetap dipertahankan. Hak mengalihkan kepemilikan pelanggan dan mengelola akun tidak diperluas. RLS cabang dan gate per tahap pipeline tetap berlaku.

Draft Outlook memakai percent encoding (`%20` untuk spasi, bukan `+`) dan teks berparagraf. Rincian diambil dari sertifikat: pekerjaan, objek, nomor seri bila ada, jenis/nomor sertifikat, lokasi, referensi SPK, dan pengingat tanggal akhir. Belum ada harga penawaran baru yang diasumsikan. Kontak `[UJI]` tetap ditandai pada subjek dan body. Membuka draft tidak mengirim email; draft lama yang telah tersimpan di Outlook tidak otomatis berubah.

# Katalog wilayah

Snapshot nama 38 provinsi dan 514 kabupaten/kota diambil dari [cahyadsn/wilayah](https://github.com/cahyadsn/wilayah), berlisensi MIT. Hash sumber dan catatan versi tercatat di `data/indonesia-regions/source.json`; lisensi dipertahankan. SQL upstream hanya dibaca sebagai data, tidak dieksekusi.

Nama kabupaten/kota menyertakan provinsi untuk membedakan wilayah dengan nama sama. Alias NTB, NTT, dan Jatim distandarkan menjadi nama provinsi lengkap dengan ID dan relasi sertifikat tetap sama. Wilayah luar Indonesia yang telah ada tetap tersedia. Kolom Lokasi menyimpan rincian alamat/situs pekerjaan.
