# Sandbox latihan VALIDA

Lingkungan ini memakai branch `codex/training-sandbox` dan proyek Supabase development `qjxwohmaqxdemlkkwdus`. Domain utama dan akun `tester@tester.com` di produksi tetap baca saja. Akun bernama sama di sandbox merupakan akun terpisah, dengan password dan MFA tersendiri.

Banner **SANDBOX LATIHAN** harus terlihat sebelum mencoba perubahan. Data alat, personil, perusahaan, dan sertifikat berlabel `[LATIHAN]` dibuat sintetis; tidak menyalin data produksi. Perubahan di sandbox tersimpan pada database latihan dan tidak mengubah website utama.

Pengguna latihan dapat memperoleh peran Super Admin dan peran operasional yang diperlukan untuk mencoba form UMA, progres PTK, proses HRGA, dan pipeline AM. MFA tetap berlaku untuk hak Super Admin. Jangan masukkan data pribadi, dokumen asli, atau alamat email pelanggan nyata ke lingkungan latihan.

Pengiriman otomatis Microsoft 365 dan email pemulihan dinonaktifkan. Unduhan dan pratinjau tetap tersedia. Jika membuka draft Outlook, itu berpindah ke aplikasi luar; jangan mengirim email sungguhan dari simulasi.

## Pengaman deployment

- `VALIDA_TRAINING_MODE=true` hanya untuk preview branch sandbox.
- `NEXT_PUBLIC_SUPABASE_URL` dan publishable key harus milik development tersebut.
- Mode latihan ditolak pada `VERCEL_ENV=production`, `APP_ENVIRONMENT=production`, atau URL database selain development yang ditentukan.
- Tidak membawa kredensial produksi atau kredensial Microsoft ke preview.
- Password dan QR MFA tidak dicantumkan dalam dokumen panduan atau repository.

## Operasional

1. Buka URL sandbox dan pastikan banner latihan terlihat.
2. Masuk dengan akun sandbox; daftarkan MFA sendiri pada login Super Admin pertama.
3. Coba tambah, ubah, arsipkan, pulihkan, dan hapus data latihan. Pemeriksaan relasi dan audit tetap berlaku.
4. Jika perlu mengulang skenario, pulihkan data dari Arsip atau minta pengelola menyiapkan dataset latihan baru. Belum ada tombol reset seluruh sandbox.
5. Gunakan domain utama hanya untuk pekerjaan operasional sebenarnya.
