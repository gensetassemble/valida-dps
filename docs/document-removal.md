# Menghapus lampiran yang salah unggah

Rilis `2026.11.10-document-removal-interactions.1`.

1. Buka detail sertifikat atau hasil kalibrasi, lalu cari lampiran PDF.
2. Pilih **Hapus** pada berkas yang salah. Periksa nama berkas pada konfirmasi.
3. Pilih **Hapus lampiran**, atau **Batal** untuk mempertahankan berkas.

Hak hapus mengikuti kewenangan menulis dokumen pada rekaman dan cabang yang sama. HRGA mengelola lampiran personil; PTK/Koordinator sesuai portofolionya mengelola lampiran hasil kalibrasi; Admin dan AM mengikuti akses sertifikat klien yang sudah berlaku. Akun baca saja tidak mendapat tombol hapus. Ketentuan MFA Admin tetap berlaku.

Nomor sertifikat, tanggal, dan status proses tidak diubah. Nama berkas yang sama dapat muncul pada dua unggahan; penghapusan memakai ID unggahan, sehingga hanya berkas yang dipilih yang dilepas. PDF yang telah direferensikan oleh log/gate pipeline dilindungi foreign key dan tidak dapat dihapus dari lampiran.

Metadata dilepas dalam transaksi database yang sekaligus mencatat audit dan ledger pembersihan privat. Pembersihan objek memakai [Supabase Storage API](https://supabase.com/docs/guides/storage/management/delete-objects), memakai sesi pengguna yang sama tanpa service-role key. Dokumen tidak dapat dibuka lagi melalui endpoint VALIDA setelah dilepas. Jika Storage sementara gagal, tombol **Ulangi hapus** melanjutkan pembersihan secara idempotent; sertifikat tidak dihapus. Jika halaman ditutup sebelum retry selesai, ledger menyimpan ID/path untuk tindak lanjut IT. Tidak ada penghapusan otomatis massal atas unggahan lama.

Migrasi: `20261110100900_remove_uploaded_document.sql`. RPC publik memakai security invoker; fungsi privat memeriksa pengguna aktif, cabang, pemilik rekaman, dan hak tulis. Ledger tidak terbuka ke API, dan identifier yang telah dihapus tidak boleh digunakan kembali untuk memulihkan akses objek.

Pengujian mencakup konfirmasi/batal, dua nama file sama, akun baca saja, cabang lain, MFA Admin, bukti yang sudah terpakai, audit, pembersihan gagal/retry, serta nomor dan tanggal sertifikat yang tetap utuh. Fixture database di-rollback; tidak menghapus dokumen nyata sebagai pengujian.
