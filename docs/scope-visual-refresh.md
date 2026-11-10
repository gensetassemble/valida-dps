# Penyelarasan visual VALIDA dengan SCOPE

Referensi: lima screenshot SCOPE yang diberikan pengguna pada 10 November 2026.

## Tampilan

- Font antarmuka: Plus Jakarta Sans, bobot 400–700, dimuat lokal dari Fontsource.
- Warna aksi utama: teal `#008580`, hover `#006d69`, tulisan tombol putih.
- Teks: navy `#0b2545`; latar halaman `#f3f6f8`; permukaan putih; garis `#dce5ef`.
- Warna peringatan masa berlaku tetap mengikuti status masing-masing.
- Kartu memakai garis tipis, sudut membulat, dan bayangan ringan.
- Menu aktif memakai latar teal muda dan teks teal.

## Pop-up bersama

`Modal` membatasi lebar normal ke 640 px dan lebar besar ke 1.080 px. Di ponsel, lebar mengikuti layar dengan margin 8 px. Tinggi mengikuti viewport dinamis.

Header tetap terlihat; hanya isi yang digulir. `footer` dipakai untuk aksi di luar bagian gulir. Formulir yang harus mempertahankan tombol submit di dalam elemen form memakai `.valida-modal-actions` agar aksi tetap terlihat tanpa mengubah validasi HTML atau pengiriman form.

Pop-up berbasis rute tetap menyediakan tautan langsung di header. Rincian memakai kelompok parameter yang diberi batas agar mudah dipindai.

Radix tetap menangani fokus, Escape, dan interaksi backdrop. Fokus kembali ke pemicu setelah penutupan, termasuk konfirmasi bertingkat.

## Interaksi

Hover tombol utama berubah dari teal ke navy; tombol outline/ghost berubah menjadi teal dengan teks putih. Tombol native (termasuk filter dan tindakan tabel) juga mendapat latar teal dan teks putih. Tombol naik 2 px tanpa bayangan. Menu navigasi memberi perubahan warna dan pergeseran ikon 2 px. Pop-up masuk dengan fade dan pergeseran 8 px selama 180 ms. `prefers-reduced-motion` menonaktifkan pergeseran dan memperpendek animasi. Buka halaman menggunakan navigasi penuh pada tab yang sama.

## Verifikasi lokal

- Fixture browser menggunakan komponen `Modal`, `ConfirmDialog`, `RecordForm`, `Button`, dan `Card` asli dengan data sintetis serta aksi penyimpanan tiruan.
- Diperiksa pada lebar 1.440 px dan 390 px: lebar pop-up, posisi header, tombol aksi saat scroll, fokus setelah Escape, konfirmasi bertingkat, font, hover, reduced motion, dan overflow.
- Alur pratinjau email juga diuji pada desktop/ponsel dengan aksi tiruan; tidak ada email dikirim.
- 270 tes pada workspace development lulus. Salinan khusus rilis visual diuji terpisah: seluruh 239 tes unit dan pemeriksaan TypeScript lulus.

Rilis `2026.11.10-scope-visual-refresh.1` hanya membawa perubahan visual. Pengembangan lampiran PDF, pemetaan portofolio, dan email/reminder yang membutuhkan migrasi terpisah tetap berada pada jalur development. Rilis visual ini tidak mengubah hak akses, data, atau aturan alur kerja.
