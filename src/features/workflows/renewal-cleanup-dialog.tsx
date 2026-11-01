"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { manageRenewal } from "./renewal-cleanup-actions";

export function RenewalCleanupDialog({
  id,
  branch,
  version,
  status,
}: {
  id: string;
  branch: string;
  version: number;
  status: string;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  const closed = status === "renewed" || status === "cancelled";
  const label = closed ? "Hapus histori" : "Batalkan proses";
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <Modal
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
        title={label}
        description={
          closed
            ? "Histori proses disembunyikan dari daftar. Sertifikat, hasil perpanjangan, dan jejak audit tetap tersimpan."
            : "Proses dihentikan dan dapat diajukan ulang. Tanggal maupun status masa berlaku sertifikat tidak berubah."
        }
      >
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const form = new FormData(event.currentTarget);
            setBusy(true);
            setError("");
            try {
              const result = await manageRenewal({
                id,
                branch,
                version,
                operation: closed ? "delete_history" : "cancel",
                reason: String(form.get("reason") || ""),
                confirmed: form.get("confirmed") === "on",
              });
              if (result.error) setError(result.error);
              else {
                setOpen(false);
                router.refresh();
              }
            } catch {
              setError("Perubahan belum tersimpan. Silakan coba kembali.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="grid gap-2 text-sm">
            Alasan
            <textarea
              name="reason"
              required
              minLength={8}
              maxLength={2000}
              disabled={busy}
              className="min-h-24 rounded-lg border border-input p-3"
            />
          </label>
          <label className="flex gap-2 text-sm">
            <input name="confirmed" type="checkbox" required disabled={busy} />
            Saya menyetujui tindakan ini.
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-800">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Kembali
            </Button>
            <Button disabled={busy}>{busy ? "Menyimpan…" : label}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
