# Persiapan Microsoft 365

Lingkungan kerja/sekolah telah dikonfirmasi pengguna. Tenant, mailbox resmi, kewenangan administrator, serta kredensial belum tersedia. Tidak ada aplikasi Entra yang dibuat, consent yang diminta, token yang disimpan, atau email yang dikirim pada tahap 01.

## Registrasi oleh administrator organisasi

1. Verifikasi tenant Microsoft Entra dan pilih mailbox notifikasi resmi; jangan menebak alamat pengirim.
2. Daftarkan `VALIDA-DPS-Mail-Integration` sebagai aplikasi **single tenant**. Pisahkan aplikasi unattended dan delegated bila tata kelola organisasi mensyaratkannya.
3. Daftarkan callback Web yang tepat: `https://<domain-disetujui>/api/microsoft/callback`; untuk pengembangan gunakan `http://localhost:3000/api/microsoft/callback`. Hindari wildcard.
4. Untuk AM, evaluasi **delegated `Mail.Send`**. Supabase tetap login utama. Sebelum OAuth diaktifkan, tambahkan state acak sekali pakai, PKCE S256, validasi state/tenant/redirect, ikatan ke UUID pengguna Supabase yang aktif, expiry, dan penyimpanan cache MSAL terenkripsi. State harus disimpan dalam cookie HttpOnly/Secure/SameSite yang terikat pada sesi.
5. Token refresh dan scope `offline_access` hanya bila kebutuhan sesi berkelanjutan disetujui. Jangan meminta `Mail.Read`, `Mail.ReadWrite`, `User.Read`, atau izin lain tanpa kebutuhan yang dibuktikan. Jangan menyimpan token pada localStorage, tabel public, log, atau cookie browser yang terbaca JavaScript.
6. Notifikasi unattended memakai izin minimum pengiriman yang disetujui administrator. Untuk application `Mail.Send`, administrator wajib membatasi cakupan mailbox di Exchange Online, memverifikasi akses positif ke mailbox yang dipilih serta penolakan mailbox lain. Evaluasi Exchange Application RBAC; jangan menggabungkan grant tenant-wide yang membuat pembatasan RBAC tidak efektif. Kredensial sertifikat/federasi lebih disukai bila didukung; secret development memerlukan rotasi dan penyimpanan server.
7. Isi env server pada environment yang disetujui. Credential terpisah untuk development dan production. Jangan menaruhnya pada `NEXT_PUBLIC_*`.
8. Implementasikan penyimpanan cache MSAL yang tahan restart dan terenkripsi dengan KMS, pemisahan pengguna/tenant, pencabutan koneksi, audit, serta refresh yang aman. `token-store.ts` saat ini menolak penulisan.
9. Aktifkan OAuth setelah implementasi dan pengujiannya disetujui. Callback saat ini selalu HTTP 503 dan tidak menukar authorization code.
10. Setiap email komersial memerlukan konfirmasi eksplisit AM atas pengirim, penerima, subjek, isi, dan lampiran final. Jangan mengirim otomatis.

## Kontrak yang sudah tersedia

`config.ts` memvalidasi tenant/client UUID dan redirect. `auth.ts` menyiapkan MSAL single tenant. `graph-client.ts` hanya menerima penyedia token server yang disetujui. `mail-service.ts` menyediakan `connectMailbox`, `getConnectionStatus`, `sendNotificationEmail`, dan `sendCommercialEmail`.

Semua operasi koneksi/pengiriman masih gagal tertutup meskipun feature flag diubah menjadi `true`. Pengaktifan memerlukan implementasi baru, pengujian, dan persetujuan; memasukkan env tidak cukup. Status **Terhubung** tidak pernah diklaim dari keberadaan kredensial.

Status koneksi: Belum Dikonfigurasi → Menunggu Otorisasi → Terhubung (setelah pemeriksaan nyata). Status pesan: Draf → Mengirim → Diterima Penyedia / Gagal. Microsoft Graph `202 Accepted` berarti Diterima Penyedia, bukan bukti penerimaan tujuan. Simpan status HTTP, request-id/client-request-id, waktu, attempt, serta kode kesalahan penyedia dengan redaksi data sensitif; jangan menyimpan access token. Status Terkirim ke Tujuan membutuhkan bukti independen yang disetujui organisasi.

Referensi: [MSAL Node](https://learn.microsoft.com/en-us/entra/msal/javascript/node/overview), [authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [Graph sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0), [Exchange application RBAC](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac).
