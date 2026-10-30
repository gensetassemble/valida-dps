# Persiapan reminder email VALIDA

Microsoft 365 kerja/sekolah telah dipilih. Implementasi saat ini masih kerangka konfigurasi dan adapter pengiriman yang dinonaktifkan. Belum ada pengiriman otomatis atau cron aktif. Tautan compose Outlook untuk tindak lanjut komersial tidak sama dengan layanan reminder otomatis.

Persiapan organisasi:

1. Tentukan mailbox pengirim resmi dan alamat reply-to. Minta IT memastikan mailbox Exchange Online dapat mengirim email.
2. Siapkan alamat email nyata penerima dan pemetaan tanggung jawab: PTK untuk alat, HRGA untuk kompetensi, AM untuk sertifikat klien, serta koordinator/pimpinan untuk eskalasi sesuai cakupan. Akun contoh `.invalid` tidak dapat menerima email.
3. Minta admin tenant mendaftarkan aplikasi Microsoft Entra untuk pengiriman tanpa pengguna sedang login. Pilihan yang disarankan adalah role `Application Mail.Send` melalui Exchange Online RBAC for Applications dengan scope khusus mailbox VALIDA. Hindari pemberian hak kirim tanpa batas seluruh mailbox secara bersamaan karena grant Entra dan RBAC dapat bersifat aditif.
4. Simpan Tenant ID, Client ID, kredensial aplikasi atau sertifikat, serta alamat mailbox di environment server Vercel. Jangan simpan secret di GitHub, variabel `NEXT_PUBLIC_`, atau chat. Kerangka delegated OAuth yang ada perlu disesuaikan untuk alur app-only bila opsi ini dipilih.
5. Tetapkan aturan: misalnya ringkasan harian H-90/H-60/H-30/H-7/H-0, pengulangan expired mingguan, dan waktu pengiriman WITA. Tentukan apakah koordinator menerima semua portofolionya dan kapan pimpinan mendapat eskalasi. Lisensi seumur hidup tidak diberi pengingat expired; tanggal kosong dilaporkan terpisah.

Implementasi berikutnya perlu mencakup scheduler, antrean pengiriman dengan kunci unik penerima/sertifikat/periode, percobaan ulang terbatas, pencatatan hasil, dan preview isi pesan. Pertimbangkan satu ringkasan per penerima agar tidak mengirim satu email untuk setiap alat. Uji terlebih dahulu ke mailbox pengujian yang disetujui sebelum penerima organisasi diaktifkan. HTTP 202 dari Graph berarti permintaan diterima, belum menjadi bukti email telah diterima penerima.

Vercel Hobby mendukung cron harian tetapi tidak menjamin menit pengiriman tepat: jadwal dalam suatu jam dapat dijalankan sepanjang jam itu. Untuk kebutuhan tepat pukul tertentu atau beberapa kali sehari, pilih scheduler/paket yang memenuhi kebutuhan tersebut.

Rujukan resmi: [Graph sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0), [Exchange RBAC for Applications](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac), [Vercel Cron usage](https://vercel.com/docs/cron-jobs/usage-and-pricing).
