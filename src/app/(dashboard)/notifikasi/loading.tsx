import styles from "@/features/notifications/inbox.module.css";
export default function NotificationLoading() {
  return (
    <section
      className={styles.center}
      aria-busy="true"
      aria-label="Memuat Pusat Notifikasi"
    >
      <h1 className="py-4">Pusat Notifikasi</h1>
      <p className="mb-5 text-xs text-slate-500" role="status">
        Memuat pemberitahuan untuk akun Anda…
      </p>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={styles.skeleton} />
        ))}
      </div>
    </section>
  );
}
