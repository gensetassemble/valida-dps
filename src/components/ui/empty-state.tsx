import { Inbox } from "lucide-react";
export function EmptyState({ filtered = false }: { filtered?: boolean }) {
  return (
    <div className="px-6 py-14 text-center">
      <Inbox
        className="mx-auto mb-3 size-7 text-muted-foreground"
        aria-hidden
      />
      <h2 className="text-sm font-bold">
        {filtered ? "Tidak ada hasil yang sesuai" : "Belum ada data"}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted-foreground">
        {filtered
          ? "Ubah atau hapus filter untuk melihat data lain."
          : "Data akan ditampilkan setelah ditambahkan oleh pengguna yang berwenang."}
      </p>
    </div>
  );
}
export function LoadingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="p-8 text-sm text-muted-foreground"
    >
      Memuat data…
    </div>
  );
}
