"use client";
import { useState } from "react";
import { Download, Eye, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PdfCanvasPreview } from "./pdf-canvas-preview";

export function CalibrationFormPreview({ id, version, disabled = false }: { id: string; version: number; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const source = `/api/workflows/form?id=${encodeURIComponent(id)}&format=pdf&version=${version}`;
  const download = source + "&download=1";
  return <>
    <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => setOpen(true)}><Eye size={14}/>Preview formulir</Button>
    {disabled ? <Button type="button" size="sm" variant="outline" disabled><Download size={14}/>Unduh PDF</Button> : <Button type="button" size="sm" variant="outline" asChild><a href={download}><Download size={14}/>Unduh PDF</a></Button>}
    <Modal open={open} onOpenChange={setOpen} size="large" title="Preview formulir terisi" description="Isian terakhir yang sudah tersimpan. Nama tercetak belum merupakan tanda tangan; lengkapi tanda tangan pengaju dan Kabid sebelum diajukan ke PTK.">
      <div className="mb-3 flex flex-wrap gap-2">
        <Button size="sm" asChild><a href={download}><Download size={14}/>Unduh PDF terisi</a></Button>
        <Button size="sm" variant="outline" asChild><a href={source} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>Buka PDF di tab baru</a></Button>
      </div>
      {open && <PdfCanvasPreview source={source}/>}
      <p className="mt-2 text-xs text-muted-foreground">Jika preview tidak tampil di perangkat ini, gunakan Buka PDF di tab baru atau Unduh PDF terisi.</p>
    </Modal>
  </>;
}
