"use client";
import { BellOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "@/features/notifications/inbox.module.css";
export default function NotificationError({ reset }: { reset: () => void }) {
  return (
    <section className={styles.center}>
      <h1>Pusat Notifikasi</h1>
      <div className={styles.empty} role="alert">
        <span>
          <BellOff aria-hidden="true" size={25} />
        </span>
        <h2>Notifikasi belum dapat dimuat</h2>
        <p>
          Silakan coba kembali. Riwayat dan status baca Anda tetap tersimpan.
        </p>
        <Button variant="outline" onClick={reset}>
          <RefreshCw aria-hidden="true" />
          Coba lagi
        </Button>
      </div>
    </section>
  );
}
