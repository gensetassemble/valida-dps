"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { todayWita } from "@/lib/domain/validity";
import { saveEmployeeStatus } from "./actions";
import { EMPLOYEE_STATUS_REASONS } from "./employee-status-model";

export function EmployeeStatusDialog({ branch, employee, version, name, status }: { branch: string; employee: string; version: number; name: string; status: string }) {
  const [open, setOpen] = useState(false), [nextStatus, setNextStatus] = useState("inactive"), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const router = useRouter();
  const input = "h-10 w-full rounded-lg border border-input bg-white px-3 text-sm";
  return <>
    <Button variant="outline" size="sm" onClick={() => { setNextStatus(status === "inactive" ? "active" : "inactive"); setError(""); setOpen(true); }}>Status personil</Button>
    <Modal open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }} title={"Status personil · " + name} description="Nonaktif menghentikan akses aplikasi. Sertifikat, penugasan, dan riwayat tetap tersimpan.">
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setError("");
        try { const result = await saveEmployeeStatus(branch, employee, version, { status: nextStatus, reason: String(f.get("reason")), effective_on: String(f.get("effective_on")), notes: String(f.get("notes")) });
          if (result.error) setError(result.error); else { setOpen(false); router.refresh(); }
        } catch { setError("Status belum tersimpan. Silakan coba lagi."); } finally { setBusy(false); }
      }}>
        <label className="grid gap-1 text-xs">Status kepegawaian<select className={input} value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}><option value="inactive">Nonaktif</option><option value="active">Aktif</option></select></label>
        <label className="grid gap-1 text-xs">Alasan<select key={nextStatus} required className={input} name="reason" defaultValue={nextStatus === "active" ? "reactivated" : ""}><option value="" disabled>Pilih alasan</option>{Object.entries(EMPLOYEE_STATUS_REASONS).filter(([key]) => (key === "reactivated") === (nextStatus === "active")).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="grid gap-1 text-xs">Tanggal efektif (WITA)<input required type="date" name="effective_on" max={todayWita()} defaultValue={todayWita()} className={input}/></label>
        <label className="grid gap-1 text-xs">Keterangan<textarea required name="notes" minLength={8} maxLength={2000} className="min-h-24 rounded-lg border border-input p-3 text-sm"/></label>
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Batal</Button><Button disabled={busy}>{busy ? "Menyimpan…" : "Simpan status personil"}</Button></div>
      </form>
    </Modal>
  </>;
}
