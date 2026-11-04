# Prompt 07 — Email koordinasi perpanjangan

## Perubahan

- Tombol **Kirim Email Perpanjangan** pada detail sertifikat klien dan **Email perpanjangan** pada kartu pipeline membuka pratinjau yang membaca sertifikat dan kontak melalui sesi pengguna/RLS.
- Nama pelanggan, PIC/jabatan/email/telepon, AM, jenis sertifikat, objek, identifikasi objek, lokasi, nomor dan tanggal berakhir dibaca dari database. Form tidak menerima penggantian alamat penerima melalui payload pengiriman.
- Subjek standar: `Konfirmasi Kebutuhan Perpanjangan Layanan {nama_layanan} – {nama_pelanggan}`. Email meminta konfirmasi kebutuhan, jadwal, dan PIC koordinasi; bukan penawaran.
- Tanggal memakai format lengkap Indonesia, dan selisih hari memakai Asia/Makassar. Kalimat berbeda untuk hari ini dan expired; tidak ada hitungan negatif. Data opsional kosong dihilangkan.
- Tanda tangan selalu **Bidang Penjualan dan Dukungan Operasi / PT SUCOFINDO Cabang Denpasar**. Nama AM hanya merupakan konteks internal.
- Mode uji berlabel `[UJI INTERNAL]`, memiliki pemberitahuan awal dan disclaimer akhir. Tujuan uji berasal dari allowlist server, bukan email pelanggan.
- **Salin Email** menyalin HTML yang telah di-escape dan teks biasa. Selama demo, semua akun yang berwenang menyiapkan pratinjau menggunakan **[UJI] Adli Alfian — adli.alfian@sucofindo.co.id**, tanpa memerlukan PIC pelanggan resmi. Label UJI INTERNAL selalu menyertai hasil salin; tidak ada pengiriman atau pencatatan kontak.
- **Buka Draf di Outlook** membuka Outlook Microsoft 365 di tab baru dengan penerima, subjek dan teks email yang sama seperti pratinjau. Demo tetap hanya menuju Adli dengan label UJI INTERNAL. Tombol ini tidak memerlukan sender Graph aktif, tidak mengirim otomatis dan tidak mengubah pipeline. Pengiriman dilakukan manual oleh pengguna di Outlook. Mode resmi tetap memerlukan penerima terverifikasi dan konfirmasi pada pratinjau sebelum membuka draf.
- Admin mengelola subjek/isi di **Pengaturan → Template Email**. Perubahan menambah versi baru; token divalidasi dan pembaruan dari versi lama ditolak untuk mencegah penimpaan bersamaan.

## Pemetaan dan ambiguitas

| Placeholder/konteks | Sumber |
| --- | --- |
| nama_pelanggan | client_certificate_display_records.client_name |
| nama_pic_pelanggan / sapaan_pic | client_contacts.name; fallback Tim + nama pelanggan |
| jabatan/email/telepon PIC | client_contacts.position/email/phone |
| AM | client_certificate_display_records.account_manager_name |
| jenis_sertifikat | certificate_type_name |
| objek_pekerjaan | object_type |
| nomor_seri_objek | object_serial, dipertahankan persis |
| nomor_sertifikat | certificate_number, dipertahankan persis |
| lokasi_pekerjaan | installation_location |
| tanggal_berakhir | expiry_date |
| sisa_hari / kalimat_masa_berlaku | kalkulasi tanggal WITA saat pratinjau |
| nama_layanan | label jenis sertifikat yang tersedia sebagai label layanan email, bukan perubahan record |

Tidak ada relasi service_type khusus pada sertifikat klien saat ini. Sesuai koreksi demo dari pengguna, label layanan email diisi otomatis dari jenis sertifikat; tidak ada lagi kolom konfirmasi nama layanan. Ini hanya label presentasi email, tidak menulis nama pekerjaan, jenis layanan atau objek baru ke database. Contoh Transnusa/PK-TLO/tanggal 30 November 2026 pada editor template hanya merupakan fixture; tidak diimpor dan tidak pernah dikirim.

## Status provider dan batas pengiriman

Microsoft Graph tersedia sebagai fondasi kode, tetapi sender masih dinonaktifkan. `mail-service.ts` tidak mengirim email, `token-store.ts` belum menyimpan cache token, dan callback OAuth menolak pertukaran token. Keberadaan variabel Entra atau flag `ENABLE_OUTLOOK_*` saja **tidak mengaktifkan** pengiriman.

Karena belum ada provider aktif, implementasi mengikuti fallback bagian 11 Prompt 07:

1. Pratinjau dan salin tersedia.
2. **Kirim Uji Email** dan **Kirim ke Pelanggan** dinonaktifkan dengan keterangan konfigurasi.
3. Server action pengiriman tetap menolak permintaan, termasuk retry dan manipulasi penerima/token/status.
4. Tidak ada pengiriman nyata, status Accepted/Delivered palsu, log percobaan fiktif, aktivitas kontak, atau transisi pipeline yang dibuat oleh pratinjau/salin/permintaan yang ditolak.
5. Log komunikasi manual yang sudah ada tetap dipertahankan. Catatan email kepada kontak `is_test` ditolak oleh server action agar tidak dihitung sebagai komunikasi pelanggan.

Sebelum mengaktifkan pengiriman diperlukan pekerjaan lanjutan terpisah: persetujuan Entra `Mail.Send`, OAuth state/PKCE dan binding pengguna, mailbox resmi, penyimpanan token terenkripsi, allowlist tujuan uji, serta ledger outbox/idempotency yang menyimpan aktor, snapshot template, penerima dari database, respons provider dan status. Tidak boleh menyalakan tombol hanya berdasarkan flag lingkungan. Respons Graph 202 hanya **Accepted**, bukan **Delivered**; timeout harus ditandai **Unknown** dan tidak dikirim ulang secara buta. Aktivitas resmi baru mengarah ke **Dihubungi** setelah hasil penyedia ditangani sesuai gate, dan tidak boleh menuju **Penawaran Terkirim** tanpa penawaran resmi.

Saat sender masih nonaktif, mode demo diputuskan server dan menggunakan tujuan Adli yang secara eksplisit disetujui pengguna. Alamat ini bukan PIC resmi dan tidak disimpan/menimpa kontak pelanggan. `VALIDA_EMAIL_TEST_RECIPIENTS` tetap merupakan konfigurasi allowlist untuk tahap integrasi mendatang, bukan syarat untuk membuka/menyalin demo. Pengiriman resmi nantinya tetap memerlukan PIC dan email terverifikasi; demo tidak pernah menjadi bypass untuk mengirim email.

## Database dan akses

### Penyederhanaan hasil kontak — 5 November 2026

- Label **Gerbang Bisnis: Transisi ke Dihubungi / Hubungi PIC** diganti **Catat Hasil Kontak**, baik dari kartu, riwayat, maupun saat menyeret kartu ke Dihubungi.
- Pada pratinjau email, tombol **Catat Hasil Kontak** melanjutkan alur yang sama. Membuka Outlook hanya memberi petunjuk langkah berikutnya, tanpa menganggap email telah terkirim.
- Form resmi hanya meminta PIC utama terverifikasi, saluran, dan hasil komunikasi. Nama/email diambil ulang dari database oleh server; subjek terisi otomatis pada rincian opsional, dan bisa disesuaikan jika subjek email aktual berbeda. Tidak ada pengisian ulang isi email.
- AM mengonfirmasi komunikasi benar-benar dilakukan. Kartu Belum Dihubungi/Ditunda masuk Dihubungi melalui gate/RPC lama. Tahap lain hanya mendapat log tambahan. Status yang berubah sejak dialog dibuka ditolak untuk mencegah pencatatan ulang transisi.
- Bila hanya ada kontak uji, dialog menyediakan **Simulasikan hasil kontak**. Hasil simulasi hanya ada di dialog dan hilang saat ditutup: tidak ada server mutation, perubahan kartu, log kontak resmi, atau notifikasi bisnis.
- Riwayat Kontak menampilkan aktivitas komunikasi, termasuk komunikasi yang sekaligus mengubah tahap. Penawaran/PO tetap memiliki validasi dokumen yang sama, dengan judul sesuai kegiatannya.

Migrasi `20261104131200_client_renewal_email_templates.sql` menambah tabel append-only `client_renewal_email_templates`, guard validasi dan RPC penyimpanan dengan optimistic version. Admin cabang dapat menyimpan; Admin/AM cabang dapat membaca. Akun baca saja tidak dapat mengelola template. Audit memakai ledger yang sudah ada. Kebijakan RLS sertifikat, kontak, riwayat dan pipeline tidak diubah.

Tidak ada record pelanggan/sertifikat, history, notifikasi atau audit lama yang dihapus/reset. Pengujian SQL dilakukan pada development dalam transaksi rollback.

## Verifikasi

- Unit: subjek/isi, signature, optional fields, layanan terpisah, WITA, hari ini/expired, label uji, escaping HTML dan validasi token.
- Server: akses tulis sertifikat, Admin-only template/test, payload penerima/token/status ditolak, permintaan ulang tidak memanggil RPC follow-up atau memalsukan keberhasilan.
- SQL: `supabase/tests/client_email_templates.sql` menguji versi, audit, konflik, role/cabang, validasi dan tidak adanya komunikasi komersial.
- Browser: komponen asli melalui fixture lokal sintetis; tidak menggunakan sesi atau kontak pelanggan nyata. Screenshot di `.tools/prompt07-visual/` bila browser tersedia.

Pengiriman aktual, penerimaan email oleh provider, delivery webhook, dan pembaruan pipeline setelah pengiriman belum dapat diuji karena integrasi belum aktif.

## Berkas utama

- `src/features/operations/renewal-email.ts`: template standar, validasi token, tanggal WITA, mode uji dan HTML aman.
- `email-actions.ts`, `email-server.ts`, `email-provider-status.ts` pada direktori yang sama: otorisasi, pemuatan/penyimpanan template, dan penolakan pengiriman yang belum dikonfigurasi.
- `renewal-email-preview.tsx`, `email-template-editor.tsx`: modal dan editor Admin.
- `src/app/(dashboard)/pengaturan/template-email/page.tsx`: halaman pengaturan dan riwayat versi.
- `src/features/operations/pages.tsx`, `pipeline-action.tsx` dan halaman pipeline: titik masuk pratinjau; draft lama diganti alur koordinasi baru.
- `src/features/operations/actions.ts`: pengecualian email uji dari pencatatan kontak pelanggan.
- App shell/breadcrumb/tab Pengaturan: navigasi template. Modal/CSS/font: tampilan email yang terisolasi.
- `.env.example`: allowlist uji server. `tests/renewal-email*.test.ts` dan SQL di atas: verifikasi.
