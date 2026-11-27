"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ImportUpload } from "./forms";

export function ClientCertificateImportButton({ branch }: { branch: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="import" onClick={() => setOpen(true)}>
        <FileUp className="size-4" aria-hidden="true" /> Impor Excel / CSV
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Impor pembaruan sertifikat klien"
        description="Unggah file, periksa perubahan penting, lalu terapkan pembaruan setelah semuanya sesuai."
        size="large"
      >
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
          File hanya dibaca untuk menampilkan perubahan. Data sertifikat baru
          diperbarui setelah Anda menekan <strong>Terapkan pembaruan</strong>.
        </div>
        <ImportUpload
          branch={branch}
          initialDomain="clients"
          lockedDomain
        />
      </Modal>
    </>
  );
}
