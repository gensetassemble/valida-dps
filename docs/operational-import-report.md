# Impor sumber dan pipeline ringkas — 29 Oktober 2026

Target development: `valida-dps-dev` / `vzxmnkmvcbzxrkzdtxuy`, WITA. Instruksi terbaru pengguna mengizinkan impor alat dan kompetensi ke website serta menghapus tahap **Perlu Verifikasi** pada modul operasional. Keputusan ini menggantikan penahanan impor operasional pada laporan tahap 03+04. Master 39 tetap ditahan sebagai batch tersendiri.

## Data yang benar-benar tersimpan

| Sumber / hasil | Jumlah |
|---|---:|
| Lisensi pada workbook final dan CSV yang direkonsiliasi | 54 |
| Kompetensi kanonis di website | **54** |
| Pemegang lisensi, directory minimal tanpa Auth | 29 |
| Lisensi berjangka / seumur hidup | 50 / 4 |
| Baris sumber kalibrasi yang cocok dengan workbook | 206 / 206 |
| Record aset setelah pengelompokan identitas sumber | **173** |
| Peristiwa kalibrasi berbeda | **181** |
| Observasi identik yang ditautkan ke peristiwa yang sama | 25 |
| Baris staging operasional bertanda Diimpor | 260 |
| Master pegawai yang tetap pending di staging | 39 |
| Akun Auth sebelum / sesudah impor | 10 / 10 |
| Sertifikat klien `[CONTOH]` / yang masuk papan saat ini | 10 / 9 |

Workbook `VALIDA Kompetensi Personil Final.xlsx` berisi 54 lisensi/29 orang yang sama dengan CSV, tetapi nomor baris bergeser. Rekonsiliasi memakai nama, judul lisensi dan nomor sertifikat, bukan menggabungkan berdasarkan nomor baris. Placeholder N/A disimpan sebagai nomor tidak tersedia; tidak dikarang. Dua tanggal yang sebelumnya salah tetap memakai tanggal ISO yang sudah dikoreksi. Empat lifetime tetap tanpa tanggal terbit, akhir dan interval. Seluruh **13 koreksi NPP** yang telah disetujui cocok dengan NPP pada pegawai yang ditautkan.

Hanya 29 referensi pemegang lisensi dibuat untuk mendukung relasi sertifikat. NPP tetap teks, kategori dan unit organisasi mengikuti sumber/master yang sesuai. Referensi ini tidak aktif untuk login dan tidak membuat Auth/profile baru; batch master 39 tidak dipromosikan massal. Judul/penerbit sumber membentuk 31 entri katalog administratif, tanpa mengarang dasar hukum atau persyaratan layanan.

Seluruh 206 koordinat sheet/baris CSV kalibrasi cocok dengan workbook `List Alat Kalibrasi 7 Portfolio.xlsx`. Record dikelompokkan secara konservatif memakai portofolio, tag/serial yang tersedia, nama/merek dan lokasi. Tag berulang dengan identitas berbeda tidak dipaksa menjadi satu aset. Observasi dengan identitas dan bukti kalibrasi yang sama ditautkan ke peristiwa yang sama; semua baris mentah tetap tersedia. **Kondisi Baik/Terpakai tidak diubah menjadi hasil Layak**. Hasil uji tetap kosong jika tidak tersedia, kepemilikan memakai Belum Dicatat, dan 43 baris sumber tanpa kedua tanggal tidak diberi tanggal buatan.

Empat biner sumber (dua CSV dan dua workbook) kini diarsipkan dalam bucket privat `import-sources`, di bawah batch terkait, dan hash SHA-256 unduhan cocok dengan berkas lokal. CSV/raw staging tidak ditimpa. Koordinat workbook final/hash serta FK sumber dicatat bersama hasil impor. Transaksi operator menyimpan audit dan alasan instruksi pengguna; tidak mengarang aktor reviewer. ID deterministik dan conflict handling membuat pengulangan tidak menambah duplikat.

## Status tanpa tahap review operasional

- Masa berlaku langsung dihitung dari tanggal sumber: Kedaluwarsa, Kritis, Perhatian, Pantau, Aman; lifetime tampil Berlaku Seumur Hidup.
- Kolom, filter dan pilihan form verifikasi dihapus dari sertifikat klien, kompetensi, alat dan peristiwa kalibrasi. Tidak ada tahapan Perlu Verifikasi di tampilan tersebut atau dashboard.
- Tanggal kosong menjadi Tanggal Belum Diisi. Kalibrasi tanpa hasil menjadi Hasil Belum Diisi; tanpa peristiwa menjadi Belum Ada Kalibrasi.
- Alat dengan hasil gagal atau masa kalibrasi lewat tidak mendapat clearance. Layak Pakai memerlukan hasil **layak yang benar-benar dicatat** dan tanggal akhir yang masih berlaku. Catatan baru tanpa hasil tidak otomatis menghapus kegagalan yang masih diketahui.
- Metadata review historis tetap disimpan; tidak ditulis massal menjadi “dokumen terverifikasi”. Verifikasi identitas akun dan hak akses tetap menjadi bagian keamanan, bukan tahapan operasional yang baru dihapus.

Pemetaan administratif pegawai ke portofolio sumber dipisahkan dari status lisensi. Lima lisensi pada empat orang belum mempunyai pemetaan portofolio sumber yang cukup jelas. Semua 54 terlihat bagi Admin, HRGA dan pembaca cabang; QSHE/Koordinator melihat 49 sesuai portofolio. Akun contoh QSHE, Koordinator dan PTK kini ditugaskan pada tujuh portofolio sumber untuk menguji workflow, tanpa menaikkan role mereka.

## Contoh klien dan alur perpanjangan

Workbook `[REQ] Table Sertifikat Klien - MVP Portfolio.xlsx` menjadi referensi struktur dan tiga skenario contoh. Tanggal/interval contoh yang berubah disesuaikan; tujuh portofolio terwakili oleh sepuluh record berlabel `[CONTOH]`. AM menggunakan akun contoh, bukan identitas orang dari workbook. Semua nominal tetap dikecualikan dari peluang riil.

Daftar klien menggabungkan pelanggan dan wilayah, menampilkan portofolio serta isian utama seperti referensi. Nilai kontrak, AM, SPK, cabang dan interval tetap tersedia pada detail/form/ekspor. Ekspor mempertahankan data lengkap dan memakai label referensi, bukan UUID portofolio.

Pipeline mengambil sertifikat aktif dengan tanggal akhir **dalam 90 hari ke depan atau sudah lewat**, serta sertifikat yang sudah mempunyai riwayat tindak lanjut. Sertifikat lama yang sudah memiliki generasi pengganti aktif tidak ditampilkan lagi. Contoh baru H+180 tanpa aktivitas belum masuk papan; sebab itu sepuluh contoh menghasilkan sembilan kartu eligible saat ini. Keputusan/aktivitas yang sudah tercatat tetap tampil sebagai riwayat tahap.

Alur: **H−90/kedaluwarsa → Belum Dihubungi → Dihubungi → Penawaran Terkirim → PO Diterima**. Alternatif Ditunda / Tidak Diperpanjang tetap tersedia. PIC utama diperlukan untuk kontak; PDF penawaran dan PO tetap menjadi bukti tahap terkait. PO tidak otomatis mengganti tanggal sertifikat: setelah sertifikat baru terbit, tautkan sebagai generasi berikutnya. Tidak ada email, PIC, bukti kontak, PO atau PDF nyata yang difabrikasi.

Papan menampilkan satu kartu paling dekat jatuh tempo per tahap, dengan jumlah dan total nilai seluruh tahap serta halaman per kolom. Enam kolom muat pada desktop, berubah menjadi grid bertumpuk pada layar sempit. Form tindak lanjut berada dalam dialog sehingga kartu tidak melebar atau memanjang. Tidak ada gulir horizontal papan.

## Verifikasi aktual

| Pemeriksaan | Hasil |
|---|---|
| `npm run lint`, `npm run typecheck`, `npm run build` | Lulus |
| `npm test` | **57/57 lulus** |
| `supabase/tests/phase34_rls.sql`, melalui konektor development | Lulus; seluruh fixture rollback |
| `supabase/tests/renewal_window.sql`, melalui konektor development | Lulus; H0/H90/H91, overdue, riwayat, generasi pengganti dan kepemilikan kosong |
| API Supabase memakai publishable key | Tujuh role diperiksa; jumlah data, lifetime dan isolasi staging cocok |
| Browser kompetensi / alat | Total 54 / 173 tampil; kolom/status Perlu Verifikasi tidak ada |
| Browser pipeline desktop 1440×900 | Enam kolom/enam kartu, papan berakhir pada y=813; lebar papan dan halaman tidak overflow |
| Browser mobile 390×844 | Halaman dan papan tidak overflow horizontal; viewport dikembalikan sesudah uji |
| Dialog tindak lanjut / halaman tahap | Keduanya bekerja; tidak mengubah data bisnis ketika diuji |

Browser diuji pada tab terpisah agar penjelajahan pengguna tidak terganggu. Screenshot hanya berisi contoh. Suite browser lama tidak diklaim dijalankan ulang seluruhnya; ekspektasi terkait tampilan terbaru telah disesuaikan.

Dua migrasi aditif diterapkan dan nama lokal mengikuti riwayat server: `20261029005925_operational_import_and_renewal_window.sql`, `20261029012326_operational_status_without_review_stage.sql`. Seed fiktif terpisah: `supabase/examples/phase35_client_mvp.sql`. Data/SQL impor perusahaan, kredensial, arsip dan hasil QA tetap di direktori privat yang diabaikan Git; bukan seed/migrasi publik.

Security advisor hanya memuat INFO ledger audit private yang sengaja tidak dibuka dan WARN leaked-password protection pada paket Free ([panduan](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). Performance advisor hanya INFO unused indexes. Tidak ada perubahan paket, deployment produksi, pengiriman email atau cron.
