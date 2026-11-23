"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {saveReminderSettings,processEmailBatch} from "./actions";
export function ReminderSettings({branch,enabled,days,canManage}:{branch:string;enabled:boolean;days:number[];canManage:boolean}) {
  const [active,setActive]=useState(enabled),[thresholds,setThresholds]=useState(days.join(", ")),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[confirm,setConfirm]=useState(false);
  const router=useRouter();
  return <section className="space-y-3 rounded-xl border border-border bg-white p-4">
    <h2 className="font-bold">Reminder masa berlaku internal</h2>
    <p className="text-xs leading-5 text-muted-foreground">HRGA/pemilik sertifikat dan Koordinator terkait menerima pengingat kompetensi; PTK/Koordinator menerima pengingat alat; AM penanggung jawab menerima pengingat klien. Personil nonaktif dan versi sertifikat lama dikecualikan.</p>
    <form className="space-y-3" onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage("");try{const values=thresholds.split(",").map(v=>v.trim()).filter(Boolean).map(Number);const r=await saveReminderSettings({branch,enabled:active,days:values});setMessage(r.error || "Pengaturan tersimpan. Pengiriman tetap mengikuti konfigurasi Microsoft 365 dan mode uji/live.");if(!r.error)router.refresh();}catch{setMessage("Pengaturan belum tersimpan.");}finally{setBusy(false);}}}>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} disabled={!canManage || busy} onChange={e=>setActive(e.target.checked)}/>Izinkan reminder untuk cabang ini</label>
      <label className="grid max-w-lg gap-1 text-xs">Ambang hari, pisahkan dengan koma<Input value={thresholds} disabled={!canManage || busy} onChange={e=>setThresholds(e.target.value)}/></label>
      <p className="text-xs text-muted-foreground">90 berarti H-90; 0 saat tanggal berakhir; -7 berarti sudah lewat 7 hari. Satu pengingat per rekaman, tanggal akhir, ambang, dan penerima. Jika jadwal terlewat, hanya ambang terdekat yang dikirim.</p>
      {canManage && <Button disabled={busy}>Simpan pengaturan</Button>}
    </form>
    {canManage && <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
      {confirm ? <><span className="text-xs">Proses hingga 100 email tertunda, dengan batas waktu sekitar empat menit?</span><Button disabled={busy} onClick={async()=>{setBusy(true);try{const r=await processEmailBatch({branch,confirmed:true});setMessage(r.error || `${r.processed} email diproses; periksa status masing-masing.`);router.refresh();}catch{setMessage("Hasil pengiriman belum dapat dikonfirmasi. Periksa riwayat.");}finally{setBusy(false);setConfirm(false);}}}>Ya, proses antrean</Button><Button variant="outline" disabled={busy} onClick={()=>setConfirm(false)}>Batal</Button></> : <Button variant="outline" onClick={()=>setConfirm(true)}>Proses antrean tertunda</Button>}
    </div>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
