"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { EvidenceForm } from "./forms";

const Preview = dynamic(() => import("@/features/workflows/pdf-canvas-preview").then(m => m.PdfCanvasPreview), { ssr: false });
type Document = { id: string; original_name: string; kind: string };

export function CertificateDocuments({ documents, domain, id, branch, canWrite }: {
  documents: Document[]; domain: string; id: string; branch: string; canWrite: boolean;
}) {
  const [added, setAdded] = useState<Document[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [cleanup, setCleanup] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<Document | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();
  const all = [...documents, ...added.filter(d => !documents.some(p => p.id === d.id))].filter(d => !removed.includes(d.id));
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const params = new URLSearchParams({ id: deleting.id, record: id, branch, domain });
      const response = await fetch("/api/documents?" + params, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.ok) { setError(result.error || "Lampiran belum dapat dihapus."); return; }
      if (selected === deleting.id) setSelected(null);
      if (result.cleanupPending) {
        setCleanup(old => [...new Set([...old, deleting.id])]);
        setMessage(result.message); setDeleting(null);
      } else {
        setRemoved(old => [...old, deleting.id]); setDeleting(null);
        setMessage(result.message); router.refresh();
      }
    } catch { setError("Hasil penghapusan belum dapat dipastikan. Gunakan Refresh sebelum mencoba lagi."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3" aria-label="Lampiran sertifikat PDF">
    <h2 className="text-sm font-bold">Lampiran dokumen PDF</h2>
    {!all.length && <p className="text-xs text-muted-foreground">Belum ada lampiran. Unggah PDF sertifikat untuk melihat pratinjaunya di sini.</p>}
    {all.map(d => <div key={d.id} className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 break-words text-sm">{d.original_name}</span>
        <div className="flex flex-wrap gap-2">
          {!cleanup.includes(d.id) && <><Button type="button" variant="outline" aria-expanded={selected === d.id} onClick={() => setSelected(selected === d.id ? null : d.id)}>{selected === d.id ? "Tutup pratinjau" : "Lihat PDF"}</Button>
          <a className="inline-flex items-center text-xs font-semibold text-primary underline" href={`/api/documents?id=${d.id}`} target="_blank" rel="noopener noreferrer">Buka PDF</a></>}
          {canWrite && <Button type="button" variant="outline" className="text-red-700" aria-label={(cleanup.includes(d.id) ? "Ulangi hapus " : "Hapus ") + d.original_name} onClick={() => { setDeleting(d); setError(""); }}><Trash2 size={14}/>{cleanup.includes(d.id) ? "Ulangi hapus" : "Hapus"}</Button>}
        </div>
      </div>
      {selected === d.id && <Preview key={d.id} source={`/api/documents?id=${d.id}&preview=1`} />}
    </div>)}
    {canWrite && <EvidenceForm domain={domain} id={id} branch={branch} onUploaded={d => { setAdded(old => [...old, d]); setSelected(d.id); }} />}
    {message && <p role="status" className="rounded-lg bg-slate-50 p-3 text-xs">{message}</p>}
    <ConfirmDialog open={!!deleting} onOpenChange={open => { if (!open && !busy) setDeleting(null); }} title="Hapus lampiran PDF?" pending={busy} error={error} confirmLabel="Hapus lampiran" destructive onConfirm={() => void remove()}>
      <p className="break-words font-semibold">{deleting?.original_name}</p>
      <p className="mt-2">Lampiran ini akan dihapus. Data sertifikat dan tanggal masa berlaku tetap tersimpan. Tindakan dicatat di audit. Dokumen yang sudah dipakai sebagai bukti pipeline tidak dapat dihapus.</p>
    </ConfirmDialog>
  </section>;
}
