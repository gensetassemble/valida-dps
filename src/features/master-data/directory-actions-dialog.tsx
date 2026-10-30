"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { DataRow } from "./server";
import { manageEmployeeDirectory } from "./directory-actions";

export function DirectoryActionsDialog({ row, branch, compact = false, onSaved }: { row: DataRow; branch: string; compact?: boolean; onSaved?: () => void }) {
  const [open, setOpen] = useState(false), [operation, setOperation] = useState("verify"), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const router = useRouter();
  const archived = !!row.archived_at;
  return <>
    <Button type="button" variant="outline" size={compact ? "icon" : "sm"} aria-label={`Kelola nama ${row.full_name}`} onClick={() => { setOperation(archived ? "restore" : row.verification_status === "verified" ? "archive" : "verify"); setError(""); setOpen(true); }}><UserRoundCog size={15}/>{!compact && "Kelola nama / hapus"}</Button>
    <Modal open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }} title="Kelola nama pegawai · IT Officer" description="Verifikasi nama tidak memverifikasi sertifikat atau memberikan akses login. Hapus dari direktori memindahkan entri ke Arsip yang dapat dipulihkan.">
      <dl className="mb-4 rounded-lg bg-slate-50 p-3 text-sm"><dt>Nama lengkap</dt><dd className="font-semibold">{String(row.full_name)}</dd><dt className="mt-2">NPP</dt><dd>{String(row.npp || "Non-NPP")}</dd></dl>
      <Link className="mb-4 inline-block text-xs underline" onClick={() => setOpen(false)} href={`/master-data/pegawai?${new URLSearchParams({ branch, q: String(row.full_name).trim().split(/\s+/).slice(0, 2).join(" ") })}`}>Cari nama serupa di direktori</Link>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault(); e.stopPropagation(); const f = new FormData(e.currentTarget); setBusy(true); setError("");
        try {
          const result = await manageEmployeeDirectory({ employee: String(row.id), branch, operation, reason: String(f.get("reason") || ""), updated_at: String(row.updated_at), confirmed: f.get("confirmed") === "on" });
          if (result.error) setError(result.error); else { setOpen(false); onSaved?.(); router.refresh(); }
        } catch { setError("Perubahan belum tersimpan. Silakan coba kembali."); } finally { setBusy(false); }
      }}>
        <label className="grid gap-1 text-xs">Tindakan<select value={operation} onChange={(e) => setOperation(e.target.value)} className="h-10 rounded-lg border border-input bg-white px-3 text-sm">{archived ? <option value="restore">Pulihkan dari Arsip</option> : <><option value="verify" disabled={row.verification_status === "verified"}>Verifikasi nama</option><option value="archive">Hapus dari direktori → Arsip</option></>}</select></label>
        <p className="text-xs text-muted-foreground">{operation === "archive" ? "Sertifikat, relasi alat, dan riwayat tetap tersimpan. Akun login aktif harus dikelola terlebih dahulu. Tidak ada penggabungan nama otomatis." : operation === "verify" ? "Cocokkan nama dan NPP dengan sumber pegawai sebelum mengonfirmasi." : "Pemulihan tidak mengaktifkan akun atau mengubah status kepegawaian."}</p>
        <label className="grid gap-1 text-xs">Dasar verifikasi / alasan<textarea name="reason" required minLength={8} maxLength={2000} className="min-h-24 rounded-lg border border-input p-3 text-sm"/></label>
        <label className="flex gap-2 text-xs"><input type="checkbox" name="confirmed" required/>Saya telah memeriksa identitas dan menyetujui tindakan ini.</label>
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Batal</Button><Button disabled={busy}>{busy ? "Menyimpan…" : operation === "archive" ? "Hapus dari direktori" : operation === "restore" ? "Pulihkan" : "Verifikasi nama"}</Button></div>
      </form>
    </Modal>
  </>;
}
