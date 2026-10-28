# Laporan Prompt 02 — VALIDA DPS

Verifikasi: 28 Oktober 2026, Asia/Makassar. Target hanya development vzxmnkmvcbzxrkzdtxuy. Tidak ada deployment produksi, upgrade paket atau email keluar.

## Hasil implementasi

Tahap 01 dilanjutkan menjadi 21 tabel public ber-RLS, multi-role per cabang, penugasan portofolio efektif, audit immutable, dan CRUD master data langsung ke Supabase. Delapan migrasi tambahan telah diterapkan; tipe database berasal dari schema aktual.

Gap awal: hanya branches/roles/profiles dan audit private, satu role lama, login dasar serta dashboard awal. Organisasi/directory/domain bisnis/UI master belum ada. Urutan kerja: organisasi → identitas/role → bisnis → guard/RLS → UI → verifikasi positif/negatif. Profil/role lama dipertahankan; role_code lama tidak menjadi sumber kewenangan.

## Migrasi dan sumber

| Versi | Perubahan |
|---|---|
| 20261028062109 | Organisasi, directory, multi-role, portofolio pegawai, domain bisnis, audit/RLS dan katalog |
| 20261028063018 | Hardening otorisasi/integritas trigger |
| 20261028064425 | Guard profil/email Auth, parent/FK dan kategori terpakai |
| 20261028070849 | Constraint katalog, identitas dan interval |
| 20261028071343 | Penugasan scope monitoring khusus Admin; HRGA hanya personnel |
| 20261028071944 | Precheck SECURITY INVOKER sebelum validasi privileged, mencegah oracle UUID/email |
| 20261028075104 | Audit DELETE tidak menambah riwayat pengalihan client |
| 20261028075921 | Initplan identitas pada tujuh policy dan indeks certificate_types FK |

Migrasi awal 20261028032607 dipertahankan. Semua file awal dibuat CLI migration new; nomor lokal mengikuti riwayat aktual cloud. Tidak ada repair riwayat atau penerapan ulang.

Katalog: DPS, Bali/NTB/NTT, 12 kode portofolio yang diminta dan tiga jenis sertifikat generik berlabel CONTOH tanpa regulasi rekaan. seed.sql tidak menambah fixture operasional.

| Sumber | Tanggung jawab |
|---|---|
| src/types/database.ts | Tipe database aktual |
| src/lib/auth/guards.ts, permissions.ts | getUser, profile/directory, role/cabang; React cache per request |
| src/features/master-data/registry.ts | Allowlist tabel/field server-owned |
| server.ts, actions.ts, validation.ts | RLS, pagination/sort, otorisasi mutation, Zod strict, hasil tulis nyata |
| record-form.tsx, filter-bar.tsx, pages.tsx | Form RHF, lookup server terbatas, filter dan daftar/detail |
| src/components/app-shell, src/components/ui, globals.css | Desain reusable, shell dan token |
| supabase/tests/phase02_rls.sql, tests/ | Verifikasi positif/negatif, unit dan browser |

[Skema/relasi dan matriks role lengkap](database-rbac.md) menjelaskan batas Admin, AM, HRGA, koordinator, QSHE, PJ, inspector dan Kepala Cabang. Seluruh hak terikat cabang; tidak ada role switcher atau metadata pengguna sebagai sumber izin.

## Layar dan desain

Selesai: split login, lupa/ganti sandi, dashboard fondasi, profil, audit, ikhtisar master, cabang, wilayah, portofolio/alias, directory/penugasan, jenis sertifikat/pemetaan kompetensi layanan, layanan, pelanggan/kontak, profil pengguna/aktivasi/multi-role dan katalog role.

Pencarian/filter/sort/pagination 20 baris dan total berjalan di server menurut RLS. Form memiliki loading, validasi/error, konfirmasi, toast; active/inactive menggantikan delete. Bulk tersedia bila sesuai. Simpan sukses memerlukan hasil rekaman nyata. Admin dapat mengubah cabang grant; cabang baru dan redefinisi role melalui migrasi organisasi.

Referensi [PRISMA](https://github.com/spatiallity/prisma) dibaca pada CSS, layout/shell/nav, login/dashboard, table/form/modal/toast. Pola visual dibuat ulang, tanpa logo/data/kode verbatim: sidebar putih 240→68 px, drawer mobile, topbar sticky 56 px, breadcrumb, profil/logout, font Plus Jakarta Sans lokal, kartu border 2 px dan tabel/form ringkas. Warna/status VALIDA tetap navy/hijau. Tombol hijau menggunakan teks navy untuk kontras.

Screenshot desktop/mobile diperiksa secara visual memakai data sintetis CONTOH; keluaran diabaikan Git. Dialog Radix menangani focus trap, Escape dan pemulihan fokus; keyboard focus/scroll tabel dan reduced motion tersedia. Tidak ada grafik/KPI palsu.

## Hasil verifikasi

| Pemeriksaan yang dijalankan | Hasil |
|---|---|
| npm run lint | Lulus |
| npm run typecheck, termasuk Next typegen | Lulus |
| npm test | 19 lulus |
| npm run build | Produksi Next.js berhasil |
| npm run test:e2e, Edge pada production server localhost | 13 lulus pada satu eksekusi akhir |
| phase02_rls.sql lewat konektor development | Lulus sesudah migrasi terakhir; satu suite assertion/expected exceptions, seluruh fixture rollback |
| Metadata tabel | 21/21 public table memakai RLS |
| Security advisor | Setelah cleanup hanya INFO audit private tanpa policy; saat akun uji ada juga muncul WARN leaked-password protection |
| Performance advisor sesudah perbaikan | Hanya INFO unused indexes; auth initplan WARN dan FK tanpa indeks terselesaikan |
| Startup/reset/lint database lokal | Belum diuji, Docker/Podman tidak tersedia |
| CI GitHub cloud/deploy Vercel | Belum dijalankan |

npm lokal dijalankan melalui node .tools/package/bin/npm-cli.js karena PATH belum menyediakannya.

Browser: empat uji anonim dan sembilan authenticated. Cakupan: login Admin/sidebar/mobile, add/edit/nonaktif wilayah/audit, pegawai+portofolio, pelanggan+kontak, isolasi AM/larangan halaman Admin, portofolio+alias/type+persyaratan layanan, pagination 22→20/2 tanpa duplikasi, profil terverifikasi+multi-role+revoke+login HRGA, Kepala Cabang read-only/logout. Sinkronisasi navigasi detail pada pengulangan grant diperbaiki agar tidak membuat duplikat sebelum tabel selesai dirender.

SQL: isolasi AM A/B, pengalihan tanpa memutus sertifikat, lintas cabang, banyak role/portofolio, HRGA, koordinator/QSHE/PJ, inspector sendiri, Kepala Cabang read-only, anon/nonaktif/directory-only, self-grant/self-activation, actor/time tamper, parent/FK/kategori, revoke langsung, audit immutable/DELETE grant ditolak dan Storage privat. UUID hanya dalam transaksi tanpa kata sandi/email.

Percobaan pengulangan suite SQL setelah cleanup tertahan error transport konektor Invalid or expired requestState. Hasil lulus di atas adalah eksekusi sesudah migrasi terakhir sebelum cleanup, bukan klaim bahwa percobaan transport tersebut berhasil. Query baca sesudahnya tetap mengonfirmasi 0 akun/pegawai/pelanggan dan 12 portofolio.

## Pembersihan dan log

Pengguna menyetujui enam akun development .invalid sementara tanpa email keluar. Setelah browser tests selesai, profil dinonaktifkan. Konektor penghapusan sempat gagal Invalid or expired requestState; Computer Use berhenti karena tidak dapat memverifikasi URL Windows. Sesudah instruksi pengguna mengambil alih, skrip transaksi yang sama berhasil melalui konektor.

Verifikasi setelah transaksi: Auth users, profiles, employees, clients, contacts, aliases, services, requirements, employee assignments, role grants dan client certificates semuanya 0. Katalog tetap 3 wilayah, 12 portofolio, 3 type. Audit migrasi katalog dipertahankan. Sessions, refresh tokens dan identities akun uji terhapus; berkas kredensial lokal juga dihapus. Log operasional platform yang dikelola Supabase tidak dihapus.

Saat uji dev ditemukan logging argumen Server Function Next.js. logging.serverFunctions=false ditambahkan dan diperiksa unit test, password uji dirotasi sebelum pengujian berikutnya lalu seluruh akun dihapus. Tidak ada credential nyata di Git/bundle.

## Temuan dan batasan eksternal

Saat akun uji ada, advisor memberi WARN leaked-password protection belum aktif. Setelah akun dihapus, hasil security advisor hanya INFO ledger private tanpa policy; perlindungan password tersebut tetap belum dikonfigurasi. Menurut [dokumentasi resmi](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), fitur memerlukan Pro atau lebih tinggi. Paket tetap Free sesuai instruksi. INFO ledger private tanpa policy adalah deny-by-default yang disengaja. Unused indexes dipertahankan untuk FK/RLS pada database tanpa beban produksi.

Akun pegawai resmi dan bootstrap Admin permanen belum tersedia. Organisasi menyediakan Auth UUID, directory terverifikasi dan grant Admin cabang pertama melalui administrator database; UI tidak mengizinkan self-grant. Recovery email terkirim/diterima, akun resmi dan MFA belum diuji.

GitHub belum mempunyai remote/push tersedia. Vercel Hobby belum digunakan untuk hosting perusahaan. Microsoft 365 kerja/sekolah menunggu Entra consent, kredensial/mailbox resmi dan penyimpanan token. Logo SUCOFINDO asli belum diberikan. Storage upload/download/signed URL masih tertutup; tidak ada dokumen nyata, cron atau pengiriman email.

Berikutnya: **Prompt 03 — Sertifikat Klien, Kompetensi Personil, dan Kalibrasi Alat CRUD**. Belum dimulai.
