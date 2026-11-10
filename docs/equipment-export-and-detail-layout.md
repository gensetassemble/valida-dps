# Ekspor portofolio dan rincian yang lebih ringkas

Rilis `2026.11.10-equipment-export-readable-details.1`.

Pada Kalibrasi Alat, tombol **Ekspor XLSX** menyediakan dua pilihan:

- **Seluruh portofolio**: alat sesuai akses akun, termasuk yang belum dipetakan ke portofolio. Nama file memakai `ALL`.
- **Pilih beberapa portofolio**: centang minimal satu portofolio. Setiap portofolio menjadi sheet laporan terpisah. Satu pilihan memakai kode portofolionya pada nama file; beberapa pilihan memakai `ALL`, mengikuti aturan nama file yang sudah berlaku.

Pilihan ini menggantikan filter portofolio tunggal pada tabel untuk ekspor tersebut. Pencarian, masa berlaku, subunit, rentang tanggal, dan filter lainnya tetap dipakai. Pemilihan dilakukan pada query database sebelum pagination, sehingga hasil tidak bergantung pada baris yang kebetulan sudah dimuat di browser. Cabang, sesi login, RLS, dan batas 10.000 rekaman tetap berlaku.

Rincian rentang/faktor koreksi pada tabel dibatasi 448 px dan tetap berada dalam viewport ponsel. Pasangan rentang dan faktor koreksi ditampilkan dalam tabel kecil; seluruh kelompok tetap tersedia melalui scroll.

Pada halaman detail, rentang dari data terstruktur ditampilkan sebagai daftar bernomor. Nilai faktor koreksi nol dan baris baru dipertahankan. Tampilan tidak memecah string lama dengan menebak batas parameter, mengubah angka, atau menulis ulang data sumber. Field multiline lain juga mempertahankan baris baru.

Masa berlaku menjadi kolom data pertama pada Kompetensi Personil, setelah No./checkbox. Offset freeze diperbarui untuk status, judul lisensi, dan nama pegawai. Judul kolom panjang dapat membungkus agar tidak bertumpuk.

Hover kini berlaku untuk tombol native maupun tombol berbentuk tautan (misalnya Matriks Kompetensi dan Tambah alat), termasuk perangkat hybrid dengan mouse dan layar sentuh. Warna teal/navy dan gerak 2–3 px memakai transisi 160–180 ms; tombol memiliki respons tekan dan tetap mendukung reduced motion. Kartu statis tidak diberi kesan dapat diklik.
