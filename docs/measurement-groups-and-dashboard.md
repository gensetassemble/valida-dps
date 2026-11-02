# Kelompok ukur dan prioritas dashboard

Rilis `2026.11.02-measurement-priorities.1` mempertahankan satu alat dan satu sertifikat kalibrasi untuk beberapa pasangan rentang ukur/faktor koreksi.

## Pengisian

- Tambah alat: **Tambah rentang ukur / kapasitas** menambahkan baris. Saat kalibrasi awal dicatat, masing-masing baris memiliki kelompok faktor koreksi sendiri; masukkan satu nilai per baris teks.
- Ubah alat: daftar rentang nominal dapat ditambah/diubah. Faktor pada sertifikat yang sudah ada tidak ditimpa melalui identitas alat.
- Tambah/ubah kalibrasi: editor pasangan menampilkan semua kelompok, termasuk kelompok dari impor. Kalibrasi baru mengambil daftar rentang alat sebagai isian awal dengan faktor kosong. Penghapusan kelompok memakai konfirmasi di dalam form, dan baru berlaku setelah simpan.
- Satu kelompok yang belum diketahui boleh kosong untuk kompatibilitas data lama. Jika terdapat beberapa kelompok atau faktor diisi, setiap rentang wajib dilengkapi. Maksimal 200 kelompok.
- Nomor `[1]`, `[2]`, dan seterusnya konsisten antara rentang dan faktor pada tabel serta ekspor XLSX. Baris baru pada faktor impor yang disimpan sebagai literal `\n` ditampilkan sebagai baris teks sebenarnya.

## Penyimpanan dan akses

Migrasi `20261102034451_equipment_repeatable_measurement_ranges.sql` sudah diterapkan pada proyek terhubung. Kolom JSON `equipment.measurement_ranges` menyimpan daftar nominal; `calibrations.monitoring_measurements` yang sudah ada menyimpan snapshot pasangan pada sertifikat. Tidak dilakukan backfill atau penafsiran ulang data impor.

Fungsi `create_equipment_with_calibration` tetap SECURITY INVOKER dan menggunakan RLS alat serta kalibrasi yang sama. Penambahan alat dan kalibrasi awal atomik; jumlah dan urutan kelompok harus sesuai daftar rentang. Satu kegagalan membatalkan kedua insert.

Saat mengubah kalibrasi, metadata sumber setiap kelompok diambil dari database berdasarkan indeks sumber, bukan dipercayai dari isian browser. Revisi `updated_at` diperiksa sebelum simpan dan pada UPDATE sehingga perubahan pengguna lain tidak tertimpa diam-diam.

## Segera Berakhir

Tabel memakai delapan kolom terpilih: kategori, entitas/alat, jenis sertifikat/uji, nomor sertifikat, tanggal akhir, sisa hari, status dan penanggung jawab. Tag, portofolio dan lokasi alat tetap sebagai keterangan entitas. Penanggung jawab klien mengikuti AM; personil menampilkan pemilik sertifikat dengan label yang jelas. Alat menggunakan penanggung jawab tersimpan, atau Koordinator Portofolio aktif jika identitas lama belum ditautkan.

Daftar tetap maksimal 20 prioritas yang akan berakhir dalam 90 hari dari query server yang sudah ada, sesuai role/cabang/filter dashboard. Lifetime dan tanggal kosong tidak masuk. Pembaruan ini tidak memperluas daftar menjadi semua sertifikat atau menambah arsip expired ke daftar tersebut.

Pencarian, filter kategori dan portofolio bekerja langsung di dalam shortlist. Kategori/portofolio hanya ditampilkan bila lebih dari satu pilihan tersedia. Jumlah hasil dan cakupan pencarian dijelaskan, tersedia reset, header tabel melekat saat scroll, dan tabel dapat digeser di layar kecil. Nama PIC dibaca dengan RLS sumber; metadata yang tidak tersedia tidak ditebak.

## Pemeriksaan

165 tes Vitest lolos, termasuk pasangan setelah hapus kelompok tengah, pelestarian metadata impor, penolakan referensi sumber lama, kompatibilitas nilai kosong, kelompok tunggal dan roundtrip XLSX. Pengujian SQL `supabase/tests/measurement_groups.sql` lolos dengan seluruh fixture di-rollback: satu alat/satu sertifikat, dua pasangan, penolakan jumlah kelompok yang tidak cocok, rollback atomik dan larangan koordinator di luar scope.

ESLint, TypeScript dan build produksi lolos. Verifikasi browser memakai form uji yang tidak disimpan serta data dashboard yang sudah ada. Tidak ada akun/data contoh baru yang dibuat permanen untuk QA.
