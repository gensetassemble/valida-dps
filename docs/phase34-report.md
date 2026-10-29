# Laporan implementasi tahap 03+04

Tanggal: 29 Oktober 2026, WITA. Target: Supabase development `valida-dps-dev` (`vzxmnkmvcbzxrkzdtxuy`), Free, Singapore. Laporan ini menjelaskan hasil development, bukan persetujuan operasional atau deployment produksi.

## Hasil dan batas verifikasi

| Modul | Status | Hasil |
|---|---|---|
| Sertifikat Klien | Selesai | CRUD, pencarian/filter/sort/pagination, detail/riwayat, nilai rupiah presisi, ekspor XLSX; daftar dan template mengikuti 14 kolom pengguna |
| Kompetensi Personil | Selesai | CRUD, satu pegawai banyak lisensi, matriks, masa berlaku berjangka/seumur hidup, folder Drive, permintaan koreksi, guard persyaratan layanan |
| Kalibrasi Alat | Selesai | Inventaris terpisah dari riwayat kalibrasi; tanggal manual/perhitungan bulan, konflik tanggal, status kelayakan konservatif |
| Impor CSV/XLSX | Selesai | Upload privat, pemetaan kolom/referensi, preview sumber, keputusan per baris, commit atomik/idempoten, ekspor kesalahan, template empat domain |
| Impor kanonis data perusahaan | Sebagian | Seluruh sumber tersimpan di staging; **0 baris diimpor** sesuai instruksi pengguna. Master 39 ditahan; pemetaan katalog/pegawai/aset tetap perlu review |
| Dashboard dan ekspor | Selesai | Query Supabase sesuai RLS, bucket tanggal WITA, 90 hari, drill-down, lifetime terpisah, nilai peluang mengecualikan contoh |
| Pipeline Perpanjangan | Selesai | Tambahan sesuai permintaan langsung pengguna: enam kolom, tindak lanjut AM, gerbang PIC/penawaran/PO, riwayat; tanpa pengiriman email |
| PDF privat | Sebagian | Validasi, metadata/otorisasi, upload dan signed URL tersedia. Uji SQL memakai metadata sintetis; browser menolak berkas bukan PDF. Siklus PDF bisnis nyata belum diverifikasi karena dokumen belum diberikan |
| Produksi / email / cron | Belum Diverifikasi | Tidak diaktifkan dan tidak dideploy |

Permintaan langsung pengguna untuk contoh sertifikat dan kanban memperluas pengecualian kanban/demo pada dokumen prompt. Enam pelanggan/sertifikat berlabel `[CONTOH]` disimpan hanya di development; nilai pada papan contoh bukan penjualan atau peluang riil. Tahap contoh yang sudah berada di Penawaran/PO merupakan skenario ilustrasi, bukan bukti dokumen atau aktivitas komersial yang pernah dilakukan.

## Rekonsiliasi sumber privat

Sumber aktual yang dilampirkan berbeda nama/format dari tiga CSV yang disebutkan dokumen prompt. Master dibaca dari `Demografi Pegawai.xlsx`, hanya sheet `PT & PTT Reguler`; sheet kelompok lain tidak dicampur. Kompetensi memakai CSV lampiran aktual, yang belum memiliki kolom pemetaan master V5 dan masih mengandung nomor lama. Perbedaan dilaporkan dan 13 koreksi kemudian disetujui pengguna; data tidak dipromosikan diam-diam menjadi V5 atau terverifikasi.

| Sumber aktual | Terbaca | Staging | Pending | Disetujui untuk impor | Diimpor kanonis | Ditolak |
|---|---:|---:|---:|---:|---:|---:|
| Master pegawai, sheet PT & PTT Reguler | 39 | 39 | 39 | 0 | 0 | 0 |
| CSV Kompetensi Personil | 54 | 54 | 54 | 0 | 0 | 0 |
| CSV Kalibrasi Alat | 206 | 206 | 206 | 0 | 0 | 0 |
| **Total** | **299** | **299** | **299** | **0** | **0** | **0** |

- Master: 39 NPP unik, masing-masing teks lima karakter, nol awal dipertahankan; 24 PT dan 15 PTT Regular. Istilah antarmuka **NPP**; header sumber **NRK** tetap dipertahankan sebagai provenance.
- Pengguna meminta **simpan master di staging dahulu**. Tidak ada directory pegawai perusahaan atau akun login yang dibuat dari sumber.
- Kompetensi: 29 orang, 50 berjangka dan empat lifetime eksplisit; empat lifetime tanpa tanggal terbit/akhir/interval. Sumber menandai 28 `SIAP_TINJAU` dan 26 `PERLU_VERIFIKASI`; label sumber bukan approval.
- Tiga pemetaan NPP yang disetujui memengaruhi **7 + 4 + 2 = 13 baris**. Hanya nilai normalized staging dikoreksi; nilai asli, nomor sebelumnya, kandidat master dan catatan/audit tetap tersedia. Perbedaan nama satu orang dengan gelar disetujui dalam keputusan yang sama. Daftar identitas lengkap berada di review lokal privat, tidak pada laporan yang dilacak Git.
- Dua koreksi ISO ke 28 Jul 2030 tetap dipakai tanpa menghilangkan teks tanggal sumber yang salah. Dua lisensi berbeda pada pemegang yang diminta tetap dua baris; nama yang dikecualikan tidak ditemukan dalam sumber.
- Kalibrasi: 206 baris, 121 `SIAP_TINJAU`, 85 `PERLU_VERIFIKASI`. Tidak ada asumsi satu baris = aset terverifikasi, hasil layak, kepemilikan, atau identitas aset.
- Sebanyak 39 baris lolos struktur master; 260 baris operasional masih membutuhkan pemetaan/review. Sebagian orang sumber tidak berada dalam master 39. Tidak dibuat orang, katalog, portofolio atau aset resmi secara otomatis.

Ketiga batch disimpan privat berurutan: master, kompetensi, kalibrasi. Raw values, sheet/baris, hash berkas, normalized values, isu dan keputusan tersimpan. Staging awal dilakukan operator melalui konektor dari parser lokal; tidak membuat akun aktor palsu. Snapshot rekonsiliasi batch dicatat sebagai audit operator pada waktu rekonsiliasi, terpisah dari waktu staging awal. Biner sumber asli tetap di lokasi privat lokal; **belum diarsipkan ke Storage lewat alur upload browser**. Upload dari aplikasi mengarsipkan biner privat dan telah diuji dengan CSV sintetis.

## Struktur dan migrasi

27 dari 27 tabel public memiliki RLS. Enam tabel tambahan: `import_batches`, `import_rows`, `personnel_correction_requests`, `operational_documents`, `renewal_opportunities`, `renewal_events`. View baca memakai `security_invoker=true`; public RPC adalah wrapper invoker, writer internal berada di schema private dengan pemeriksaan cabang/peran.

Sepuluh migrasi tahap ini telah diterapkan; nama lokal diselaraskan dengan riwayat server:

```text
20261028155824_phase34_operational_imports.sql
20261028161541_phase34_review_guards_dashboard.sql
20261028161850_phase34_pipeline_board.sql
20261028163317_phase34_precision_indexes.sql
20261028164528_phase34_validity_review_labels.sql
20261028165055_phase34_test_source_retention.sql
20261028165438_phase34_provenance_guards.sql
20261028170010_phase34_dashboard_drilldown.sql
20261028211644_phase34_import_review_integrity.sql
20261028212150_phase34_client_framework.sql
```

Sumber: `src/features/operations/`, `src/features/imports/`, `src/lib/domain/`, `src/lib/http/`, `src/types/database.ts`, serta routes di `src/app/`. Contoh development terpisah di `supabase/examples/phase34_development.sql`; bukan seed produksi dan bukan migrasi otomatis.

## Keamanan dan perilaku bisnis

Admin impor terbatas cabang; HRGA/Inspector tidak membaca staging. AM mengikuti penugasan pelanggan saat ini; perpindahan AM mempertahankan sertifikat dan riwayat. Kepala Cabang hanya membaca. Pegawai tanpa Auth tetap dapat mempunyai lisensi. Inspector hanya mengajukan koreksi, bukan mengesahkan lisensi sendiri. Kategori kepegawaian terpisah dari role aplikasi.

Upload CSV/XLSX maksimum 5 MiB/2.500 baris, PDF 10 MiB. Request dibatasi saat streaming sebelum `formData`; autentikasi dan pemeriksaan origin mendahului parsing. XLSX diperiksa terhadap ukuran hasil ekstraksi, jumlah entri, macro, enkripsi, traversal path dan ZIP64. Nilai sumber tetap teks; nilai rupiah memakai representasi desimal teks untuk menghindari pembulatan JavaScript.

`import-sources` dan `certificate-documents` privat. Dokumen mengikuti parent yang dapat diakses; objek yatim/parent tidak sah ditolak. Signed URL 60 detik hanya setelah otorisasi. Folder Drive dibatasi URL HTTPS folder yang valid; tidak dicrawl, diubah sharing-nya, atau diperlakukan sebagai PDF/bukti verifikasi.

Commit impor memerlukan review dan konfirmasi eksplisit `IMPOR DPS DEVELOPMENT`, dibatasi ref development yang disetujui. Seluruh batch atomik; konflik membatalkan seluruh transaksi. Upload/hash dan commit ulang idempoten; tidak menimpa review. Semua hasil impor tetap belum diverifikasi dan tidak membuat akun Auth.

Perpindahan pipeline diperiksa server: PIC utama terverifikasi untuk kontak, PDF penawaran terkait untuk Penawaran, PDF PO untuk PO Diterima. Catatan dan urutan wajib; histori tidak dapat ditulis langsung oleh aplikasi. Tidak mengirim email, sehingga status ini tidak boleh diartikan sebagai bukti pengiriman Outlook otomatis.

## Verifikasi aktual

Perintah npm standar setara dengan `node .tools/package/bin/npm-cli.js ...` yang dipakai pada komputer ini karena npm belum ada di PATH.

| Pemeriksaan | Perintah/cara | Hasil |
|---|---|---|
| Lint | `npm run lint` | Lulus |
| TypeScript | `npm run typecheck` | Lulus |
| Unit/security | `npm test` | **51/51 lulus**, empat file |
| Build produksi lokal | `npm run build` | Lulus, 34 halaman digenerasi; routes data dinamis |
| Browser Edge | `$env:PLAYWRIGHT_CHANNEL='msedge'; npm run test:e2e -- --workers=1` | **20/20 lulus**, 2,2 menit: empat anonim, sembilan tahap 02, tujuh tahap 03+04 |
| RLS operasional | Isi `supabase/tests/phase34_rls.sql` melalui konektor development | **Lulus**, transaksi rollback, seluruh assertion sukses |
| RLS regresi tahap 02 | `supabase/tests/phase02_rls.sql` | Suite dipertahankan dan diperbaiki scoping fixture. Percobaan ulang akhir tidak menghasilkan hasil karena konektor `Invalid or expired requestState`; tidak diklaim lulus ulang. Sembilan uji browser regresi tahap 02 lulus |
| Dependency produksi | `npm audit --omit=dev` | **0 vulnerabilities** |
| Scan sumber/secret | Inventory Git termasuk kandidat untracked, pola secret dan path terlarang | Tidak ada secret atau file privat yang ikut dilacak |
| Scan nilai sumber | 261 nama/nomor sertifikat/tautan privat dibandingkan sumber dan 933 berkas build server/static | **0 berkas cocok** |
| RLS metadata | Query `pg_class` | **27/27** tabel public memiliki RLS |
| Database lokal/CI | Docker/Podman dan CLI login belum tersedia; CI cloud belum dijalankan | **Belum Diverifikasi**, bukan pass lokal yang dikarang |

Unit test mencakup batas H+1/H0/30/31/60/61/90/91, tengah malam WITA, leap year/end-of-month, lifetime/pending, presisi nominal, parser CSV BOM/quoted/CRLF/duplikat, XLSX Data+Petunjuk, batas ZIP/request, dan guard persyaratan unknown/expired/lifetime. Fixture publik memakai identitas sintetis.

SQL operasional membuktikan: Admin saja dapat staging/commit; master nol awal tanpa Auth; duplikat idempoten; konflik batch rollback; empat lifetime tidak masuk expiry; satu orang dua lisensi; satu aset banyak kalibrasi; gagal/overdue/pending tidak menjadi clearance aman; gerbang negatif dan positif PIC→penawaran→PO; histori immutable; dokumen tidak terlihat AM lain; koreksi sendiri diizinkan tetapi Kepala Cabang ditolak; provenance/flag contoh tidak dapat dipalsukan aplikasi. Uji dokumen positif SQL memakai metadata sintetis dalam transaksi, bukan biner PDF perusahaan.

Browser membuktikan CRUD nyata dan hubungan tersebut, template klien 14 kolom, nilai di atas batas integer presisi JS, ekspor RLS, import CSV sintetis dengan review manual dan NPP nol awal, perhitungan due date tanpa mengetik tanggal hasil, penolakan PDF tidak valid dan AM lintas pelanggan, serta tampilan desktop/mobile tanpa pelebaran halaman. Screenshot pengujian berisi fixture sintetis dan disimpan pada `.artifacts/` yang diabaikan Git.

Security advisor sesudah pembersihan hanya INFO `private.profile_authorization_audit` tanpa policy, disengaja sebagai ledger yang tidak dibuka ke client ([penjelasan linter](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)). Tidak ditemukan tabel public tanpa RLS. Saat akun uji tersedia, advisor mengingatkan leaked-password protection belum aktif; paket tetap Free sesuai arahan pengguna ([panduan password](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). Performance advisor hanya INFO unused indexes pada development berisi sedikit data ([penjelasan](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)); bukan hasil benchmark produksi.

## Pembersihan dan keadaan akhir

Enam akun `.invalid` sementara dibuat berdasarkan izin pengguna. Seluruh sesi, profil, role, rekaman bisnis/import sintetis dan akun tersebut dihapus. Tiga objek CSV uji dihapus melalui **Storage API**, bukan menghapus metadata storage lewat SQL. File kredensial fixture lokal dihapus sesudah verifikasi cloud. Seed enam sertifikat yang diminta pengguna dipertahankan.

Query akhir development membuktikan: **Auth 0, profil 0, sesi 0, directory pegawai 0, kompetensi kanonis 0, kalibrasi kanonis 0, sertifikat klien riil 0, sertifikat contoh 6, staging pending 299, baris koreksi NPP 13, objek pada kedua bucket 0**. Tidak ada akun demo permanen atau pegawai perusahaan yang diaktifkan.

## Keputusan lanjutan

Master 39 tetap ditahan di staging sesuai instruksi terbaru; tidak diperlukan persetujuan ulang untuk menyimpannya di sana. Pemetaan 13 baris sudah disetujui dan tersimpan. Promosi kanonis berikutnya memerlukan arahan pengguna dan review identitas/katalog/aset yang masih belum lengkap. Verifikasi dokumen tetap keputusan terpisah.

Organisasi masih perlu menyediakan akun Auth resmi serta bootstrap Admin pertama yang berwenang. Tidak ada login yang dibuat otomatis dari directory. Microsoft 365 tetap menunggu konfigurasi Entra/consent/mailbox; semua flag pengiriman tetap false. Tidak ada email, cron, deployment/push produksi atau peningkatan paket berbayar dalam tahap ini. Lihat [integrasi Microsoft 365](microsoft-365.md) dan [deployment](deployment.md).
