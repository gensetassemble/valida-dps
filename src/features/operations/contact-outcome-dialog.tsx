"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {Modal} from "@/components/ui/modal";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {getRenewalEmailPreview,recordClientContact,type EmailPreviewData} from "./email-actions";
import {renderRenewalEmail} from "./renewal-email";
type ContactOutcomeProps={open:boolean;onOpenChange:(open:boolean)=>void;certificate:string;branch:string;onPrepareEmail?:()=>void};
export function ContactOutcomeDialog(props:ContactOutcomeProps) {
 return props.open ? <ContactOutcomeContent key={props.certificate+":"+props.branch} {...props}/> : null;
}
function ContactOutcomeContent({open,onOpenChange,certificate,branch,onPrepareEmail}:ContactOutcomeProps) {
 const [data,setData]=useState<EmailPreviewData>(),[error,setError]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[simulated,setSimulated]=useState(false);
 const [contactId,setContactId]=useState(""),[channel,setChannel]=useState("email"),[note,setNote]=useState(""),[subject,setSubject]=useState("");
 const router=useRouter();
 useEffect(()=>{
  let cancelled=false;
  void getRenewalEmailPreview({certificate,branch}).then(result=>{if(cancelled)return;if(!result.data)setError(result.error || "Data kontak belum tersedia.");else{setData(result.data);setContactId(result.data.contacts.find(c=>!c.is_test && c.is_primary && c.verification_status === "verified")?.id || "");}}).catch(()=>{if(!cancelled)setError("Hasil kontak belum dapat dimuat. Silakan coba kembali.");}).finally(()=>{if(!cancelled)setLoading(false);});
  return ()=>{cancelled=true;};
 },[certificate,branch]);
 const official=data?.contacts.filter(c=>!c.is_test && c.is_primary && c.verification_status === "verified") || [];
 const contact=official.find(c=>c.id===contactId);
 const draftSubject=data && contact ? renderRenewalEmail({...data.context,pic:contact.name},data.template,"official").subject : "";
 const move=data && ["uncontacted","deferred"].includes(data.stage);
 return <Modal open={open} onOpenChange={v=>{if(!busy)onOpenChange(v);}} title="Catat Hasil Kontak" description={data ? data.context.customer+" · "+data.context.number : "Catat hasil komunikasi setelah menghubungi PIC."}>
  {loading && <p role="status">Memuat PIC dan status kartu…</p>}
  {data && official.length === 0 && <div className="space-y-4">
   <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6"><strong>Demo · Kontak uji Adli Alfian</strong><p>Draf Outlook digunakan untuk mencoba email. Pengiriman uji ke Adli tidak dihitung sebagai kontak pelanggan resmi.</p></div>
   <div className="rounded-lg bg-slate-50 p-3 text-xs leading-6"><strong>Alur saat digunakan resmi</strong><p>1. Siapkan email dan kirim melalui Outlook, atau hubungi PIC melalui telepon/WhatsApp.</p><p>2. Catat hasilnya, misalnya: “PIC meminta jadwal inspeksi minggu depan.”</p><p>3. Setelah dikonfirmasi, kartu masuk Dihubungi. Penawaran dicatat pada tahap berikutnya.</p></div>
   <label className="grid gap-1 text-xs font-semibold">Hasil simulasi (opsional)<textarea className="min-h-20 rounded-lg border border-input p-3 font-normal" value={note} onChange={e=>setNote(e.target.value)} maxLength={2000} placeholder="Contoh: PIC meminta penawaran dan jadwal inspeksi minggu depan."/></label>
   {simulated && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">Simulasi: Dihubungi. Ini hanya pratinjau alur; status kartu dan riwayat pelanggan tidak diubah.</p>}
   <div className="flex flex-wrap gap-2"><Button type="button" onClick={()=>setSimulated(true)}>Simulasikan hasil kontak</Button>{onPrepareEmail && <Button type="button" variant="outline" onClick={()=>{onOpenChange(false);onPrepareEmail();}}>Kembali ke Email Perpanjangan</Button>}<Button type="button" variant="outline" onClick={()=>onOpenChange(false)}>Tutup</Button></div>
   <p className="text-[11px] text-muted-foreground">Untuk penggunaan resmi, lengkapi PIC utama pelanggan terlebih dahulu.</p><Link className="text-xs text-primary-hover underline" href={`/pelanggan/${data.clientId}?branch=${branch}`}>Kelola kontak pelanggan</Link>
  </div>}
  {data && official.length>0 && <form className="space-y-4" onSubmit={async e=>{
   e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError("");
   try{const result=await recordClientContact({certificate,branch,contact:contactId,channel,note,expectedStage:data.stage,confirmed:f.get("confirmed") === "on",...(channel === "email" ? {subject:subject || draftSubject} : {})});if(result.error)setError(result.error);else{onOpenChange(false);router.refresh();}}
   catch{setError("Hasil kontak belum tersimpan. Periksa kembali sebelum mencoba ulang.");}finally{setBusy(false);}
  }}>
   <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-6">Isi setelah komunikasi dengan PIC resmi benar-benar dilakukan. Tidak perlu menyalin ulang isi email. {move ? "Kartu akan masuk Dihubungi, bukan Penawaran Terkirim." : "Catatan ditambahkan ke riwayat tanpa mengubah tahap kartu."}</p>
   <label className="grid gap-1 text-xs font-semibold">PIC yang dihubungi<select className="h-10 rounded-lg border border-input bg-white px-3" value={contactId} onChange={e=>{setContactId(e.target.value);setSubject("");}} required disabled={busy}><option value="">Pilih PIC resmi</option>{official.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <label className="grid gap-1 text-xs font-semibold">Melalui<select className="h-10 rounded-lg border border-input bg-white px-3" value={channel} onChange={e=>setChannel(e.target.value)} disabled={busy}><option value="email">Email</option><option value="phone">Telepon</option><option value="whatsapp">WhatsApp</option><option value="meeting">Pertemuan</option></select></label>
   {channel === "email" && <details className="rounded-lg border border-border p-3 text-xs"><summary className="cursor-pointer font-semibold">Rincian email · {contact?.email || "Email belum tersedia"}</summary><label className="mt-3 grid gap-1">Subjek email (ubah hanya jika berbeda dari draf)<Input value={subject || draftSubject} onChange={e=>setSubject(e.target.value)} maxLength={200} disabled={busy}/></label></details>}
   <label className="grid gap-1 text-xs font-semibold">Hasil komunikasi<textarea value={note} onChange={e=>setNote(e.target.value)} required minLength={8} maxLength={2000} disabled={busy} className="min-h-24 rounded-lg border border-input p-3 font-normal" placeholder="Contoh: PIC masih membutuhkan layanan dan meminta jadwal inspeksi minggu depan."/></label>
   <label className="flex gap-2 text-xs"><input type="checkbox" name="confirmed" required disabled={busy}/>Saya sudah berkomunikasi dengan PIC resmi ini; catatan ini bukan simulasi atau draf yang belum dikirim.</label>
   <div className="valida-modal-actions flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>onOpenChange(false)}>Batal</Button><Button disabled={busy || !contactId}>{busy ? "Menyimpan…" : move ? "Simpan hasil & tandai Dihubungi" : "Simpan hasil kontak"}</Button></div>
  </form>}
  {error && <p role="alert" className="mt-3 text-xs text-red-800">{error}</p>}
 </Modal>;
}
