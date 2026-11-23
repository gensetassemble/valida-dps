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
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileUp /> Impor Excel / CSV
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Impor pembaruan sertifikat klien"
        description="Unggah, periksa pemetaan, review setiap perubahan penting, lalu terapkan setelah dikonfirmasi."
        size="large"
      >
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
          File hanya dibaca pada tahap pratinjau. Data sertifikat belum berubah
          sampai baris selesai direview dan batch dikonfirmasi.
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
