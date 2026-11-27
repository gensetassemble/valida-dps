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
        description="Pilih file → Periksa perubahan → Terapkan pembaruan."
        size="large"
      >
        <ImportUpload
          branch={branch}
          initialDomain="clients"
          lockedDomain
        />
      </Modal>
    </>
  );
}
