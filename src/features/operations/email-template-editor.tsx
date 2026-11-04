"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {saveRenewalEmailTemplate} from "./email-actions";
import {DEFAULT_EMAIL_TEMPLATE,EMAIL_PLACEHOLDERS,EMAIL_SIGNATURE,renderRenewalEmail,emailHtml,validateEmailTemplate,type EmailTemplate} from "./renewal-email";
export function EmailTemplateEditor({branch,template}:{branch:string;template:EmailTemplate}) {
  const [subject,setSubject]=useState(template.subject),[body,setBody]=useState(template.body),[version,setVersion]=useState(template.version);
  const [pending,setPending]=useState(false),[message,setMessage]=useState("");
  const router=useRouter();
  const preview=renderRenewalEmail({customer:"Transnusa",serviceName:"Residual Disinsection",certificateType:"Residual Disinsection",object:"Pesawat Airbus A320",serial:"PK-TLO",number:"E0034/AOCAAT",location:"Bandara Ngurah Rai",expiryDate:"2026-11-30",pic:"Tim Koordinasi"},{subject,body,version},"test");
  return <div className="grid gap-4 xl:grid-cols-2">
    <form className="space-y-4 rounded-xl border border-border bg-white p-4" onSubmit={async e=>{
      e.preventDefault();setMessage("");const invalid=validateEmailTemplate(subject,body);if(invalid){setMessage(invalid);return;}
      setPending(true);try{const result=await saveRenewalEmailTemplate({branch,subject,body,version});if(result.error)setMessage(result.error);else if(result.version){setVersion(result.version);setMessage(`Template versi ${result.version} tersimpan. Versi sebelumnya tetap tersedia.`);router.refresh();}}
      catch{setMessage("Template belum tersimpan. Periksa koneksi dan akses.");}finally{setPending(false);}
    }}>
      <p className="text-xs text-muted-foreground">{version ? `Versi aktif: ${version}` : "Template standar · belum ada perubahan tersimpan"}</p>
      <label className="grid gap-2 text-sm font-semibold">Subjek<Input value={subject} maxLength={300} disabled={pending} onChange={e=>setSubject(e.target.value)}/></label>
      <label className="grid gap-2 text-sm font-semibold">Isi email<textarea className="min-h-96 w-full rounded-lg border border-input p-3 text-sm leading-6" value={body} maxLength={8000} disabled={pending} onChange={e=>setBody(e.target.value)}/></label>
      <p className="text-xs text-muted-foreground">Kolom kosong dihilangkan saat dirender. Gunakan {'{kalimat_masa_berlaku}'} agar kalimat mengikuti kondisi belum berakhir, hari ini, atau expired. Tanda tangan dan label uji ditambahkan otomatis.</p>
      <div className="flex flex-wrap gap-1">{EMAIL_PLACEHOLDERS.map(name=><code key={name} className="rounded bg-slate-50 px-2 py-1 text-[10px]">{'{'+name+'}'}</code>)}</div>
      <div className="rounded-lg bg-slate-50 p-3 text-xs whitespace-pre-line">{EMAIL_SIGNATURE}</div>
      <div className="flex flex-wrap gap-2"><Button disabled={pending}>{pending ? "Menyimpan…" : "Simpan versi baru"}</Button><Button type="button" variant="outline" disabled={pending} onClick={()=>{setSubject(DEFAULT_EMAIL_TEMPLATE.subject);setBody(DEFAULT_EMAIL_TEMPLATE.body);setMessage("Template standar dipulihkan di formulir. Simpan untuk menerapkannya.");}}>Pulihkan template standar</Button><Button type="button" disabled title="Mailbox Microsoft 365 belum terhubung.">Kirim Uji Email</Button></div>
      {message && <p role="status" className="text-xs text-amber-900">{message}</p>}
    </form>
    <div className="min-w-0 space-y-3 rounded-xl border border-border bg-white p-4">
      <h2 className="text-base font-bold text-brand-navy">Pratinjau placeholder</h2><p className="text-xs text-muted-foreground">Contoh dari Prompt 07; bukan data yang dikirim atau disimpan sebagai sertifikat. Sisa hari dihitung dari tanggal WITA saat ini.</p>
      <div className="rounded-lg bg-slate-50 p-3 text-sm"><strong>Subjek:</strong> {preview.subject}</div>
      <div aria-label="Pratinjau template" dangerouslySetInnerHTML={{__html:emailHtml(preview.body)}}/>
    </div>
  </div>;
}
