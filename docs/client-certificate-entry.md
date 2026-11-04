# Form sertifikat klien

- Interval menerima Hari, Bulan, atau Tahun. Tahun disimpan sebagai 12 bulan per tahun, sehingga perhitungan tanggal tetap mengikuti kalender.
- Pelanggan dan jenis sertifikat dapat dicari dalam dropdown atau dibuat dengan **Tambah baru → Simpan & pilih**. Entri langsung masuk direktori, walaupun formulir sertifikat kemudian ditutup. Nama yang sama (tanpa membedakan kapital/spasi berulang) memakai entri aktif yang sudah ada; entri nonaktif harus dipulihkan administrator.
- Penambahan referensi memakai sesi pengguna dan RLS; hanya Admin dan AM cabang terkait. Jenis yang dibuat selalu berkategori klien, dan pelanggan baru ditugaskan kepada pembuatnya. Identitas pembuat dicatat oleh audit database.
- Nilai kontrak tampil sebagai `IDR 170.000.000,-` setelah selesai mengisi; saat fokus, angka dapat diedit dengan koma desimal. Data disimpan sebagai string desimal tanpa pembulatan melalui JavaScript Number.
- Wilayah dicari di dalam dropdown. Pencarian mencakup seluruh katalog, dengan maksimal 20 hasil per pencarian.
- Generasi sebelumnya tidak tampil pada formulir umum. Relasi dan riwayat perpanjangan yang sudah ada tetap disimpan; kandidat `[CONTOH]` dikecualikan dari lookup relasi sertifikat.

Validasi: Vitest, lint, build produksi, serta `supabase/tests/inline_client_references.sql` pada development dalam transaksi rollback (penambahan, deduplikasi, audit, penyimpanan sertifikat, pembatasan cabang/kategori/peran baca).
