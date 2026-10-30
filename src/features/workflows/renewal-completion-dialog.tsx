"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { addMonths, todayWita, validDate } from "@/lib/domain/validity";
import { completePersonnelRenewal } from "./actions";

export function RenewalCompletionDialog({ branch, caseId, version, title, issuer }: { branch: string; caseId: string; version: number; title: string; issuer: string }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [issued, setIssued] = useState(""), [months, setMonths] = useState("12"), [automatic, setAutomatic] = useState(true);
  const router = useRouter();
  const calculated = validDate(issued) && Number(months) > 0 ? addMonths(issued, Number(months)) : "";
  const input = "h-10 w-full rounded-lg border border-input bg-white px-3 text-sm";
  return <>
    <Button size="sm" variant="outline" onClick={() => { setError(""); setOpen(true); }}>Catat sertifikat terbaru</Button>
    <Modal open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }} title="Sertifikat terbaru · HRGA" description={title + ". Sertifikat baru dan penyelesaian proses disimpan bersamaan. Riwayat sertifikat lama tetap tersedia."}>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setError("");
        try { const result = await completePersonnelRenewal(branch, caseId, version, { certificate_number: String(f.get("certificate_number")), issuer: String(f.get("issuer")), issue_date: issued, interval_months: months ? Number(months) : null, expiry_date: automatic ? calculated : String(f.get("expiry_date")), source_folder_url: String(f.get("source_folder_url")), notes: String(f.get("notes")) });
          if (result.error) setError(result.error); else { setOpen(false); router.refresh(); }
        } catch { setError("Sertifikat belum tersimpan. Silakan coba lagi."); } finally { setBusy(false); }
      }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">Nomor sertifikat terbaru<input required name="certificate_number" maxLength={200} className={input}/></label>
          <label className="grid gap-1 text-xs">Penerbit<input name="issuer" defaultValue={issuer} maxLength={200} className={input}/></label>
          <label className="grid gap-1 text-xs">Tanggal terbit terbaru<input required type="date" max={todayWita()} value={issued} onChange={(e) => setIssued(e.target.value)} className={input}/></label>
          <label className="grid gap-1 text-xs">Interval (bulan)<select value={months} onChange={(e) => setMonths(e.target.value)} className={input}><option value="">Sesuai tanggal dokumen</option>{[1,3,6,12,18,24,36,48,60,120].map((n) => <option key={n} value={n}>{n} bulan</option>)}</select></label>
          <label className="grid gap-1 text-xs">Tanggal berakhir otomatis<select className={input} value={automatic ? "yes" : "no"} onChange={(e) => setAutomatic(e.target.value === "yes")}><option value="yes">Ya — tanggal terbit + interval</option><option value="no">Gunakan tanggal dokumen</option></select></label>
          <label className="grid gap-1 text-xs">Tanggal berakhir{automatic ? <input type="date" value={calculated} readOnly required className={input}/> : <input required type="date" name="expiry_date" min={issued} className={input}/>}</label>
        </div>
        <label className="grid gap-1 text-xs">Folder bukti Google Drive<input required type="url" name="source_folder_url" placeholder="https://drive.google.com/drive/folders/…" className={input}/></label>
        <label className="grid gap-1 text-xs">Catatan penyelesaian<textarea required name="notes" minLength={8} maxLength={4000} className="min-h-20 rounded-lg border border-input p-3 text-sm"/></label>
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Batal</Button><Button disabled={busy || (automatic && !calculated)}>{busy ? "Menyimpan…" : "Simpan & selesaikan perpanjangan"}</Button></div>
      </form>
    </Modal>
  </>;
}
