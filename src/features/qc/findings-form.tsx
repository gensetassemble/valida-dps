"use client";

import { useState } from "react";
import { Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitQcFindings } from "./actions";
import { QC_MAX_FINDINGS, type QcDomain, type QcFindingDraft } from "./model";

function emptyFinding(): QcFindingDraft {
  return { requestId: crypto.randomUUID(), title: "", body: "" };
}

export function QcFindingsForm({ branch, domain, record, onCreated, onBusyChange }: {
  branch: string; domain: QcDomain; record: string;
  onCreated: (ids: string[]) => void; onBusyChange: (busy: boolean) => void;
}) {
  const [findings, setFindings] = useState<QcFindingDraft[]>(() => [emptyFinding()]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  function update(id: string, field: "title" | "body", value: string) {
    setFindings(items => items.map(item => item.requestId === id ? { ...item, [field]: value } : item));
  }
  return <form className="space-y-2 rounded-xl border border-teal-200 bg-teal-50/40 p-3" onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); onBusyChange(true); setError("");
    try {
      const result = await submitQcFindings({ branch, domain, record, findings });
      if (result.error) setError(result.error);
      else if (result.ids) onCreated(result.ids);
    } catch {
      setError("Koneksi terputus. Kirim kembali isian yang sama; temuan tidak akan dibuat ganda.");
    } finally { setBusy(false); onBusyChange(false); }
  }}>
    <p className="text-xs leading-snug text-muted-foreground">Isi beberapa poin, lalu kirim sekaligus. Setiap poin dapat ditanggapi dan diselesaikan sendiri.</p>
    {findings.map((finding, index) => <fieldset key={finding.requestId} disabled={busy} className="relative min-w-0 rounded-lg border border-border bg-white px-3 pb-3 pt-1">
      <legend className="px-1 text-xs font-bold">Poin {index + 1}</legend>
      {findings.length > 1 && <Button type="button" size="icon" variant="ghost" className="absolute -top-3 right-2 size-7 bg-white" aria-label={`Hapus poin ${index + 1}`} onClick={() => setFindings(items => items.filter(item => item.requestId !== finding.requestId))}><Trash2 size={14}/></Button>}
      <div className="grid items-start gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]">
        <label className="grid min-w-0 gap-1 text-xs font-semibold" htmlFor={"qc-title-" + finding.requestId}>Bagian yang perlu diperiksa
          <Input id={"qc-title-" + finding.requestId} value={finding.title} onChange={event => update(finding.requestId, "title", event.target.value)} required maxLength={160} placeholder="Contoh: Nomor seri berbeda"/>
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-semibold" htmlFor={"qc-note-" + finding.requestId}>Catatan
          <textarea id={"qc-note-" + finding.requestId} value={finding.body} onChange={event => update(finding.requestId, "body", event.target.value)} required maxLength={4000} rows={2} placeholder="Jelaskan bagian yang perlu diperbaiki…" className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm font-normal leading-snug"/>
        </label>
      </div>
    </fieldset>)}
    <div className="sticky bottom-0 z-10 space-y-2 border-t border-teal-100 bg-[#f5fcfb] py-2">
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy || findings.length >= QC_MAX_FINDINGS} onClick={() => {
          const finding = emptyFinding(); setFindings(items => [...items, finding]);
          requestAnimationFrame(() => document.getElementById("qc-title-" + finding.requestId)?.focus());
        }}><Plus size={14}/>Tambah poin temuan</Button>
        <Button size="sm" disabled={busy}><Send size={14}/>{busy ? "Mengirim…" : `Kirim ${findings.length} poin temuan`}</Button>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">Maksimal {QC_MAX_FINDINGS} poin. Pemberitahuan diteruskan ke {domain === "calibration" ? "PTK terkait" : "HRGA cabang"} atau Super Admin.</p>
    </div>
  </form>;
}
