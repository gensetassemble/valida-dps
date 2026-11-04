"use client";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/space-grotesk/600.css";
import Link from "next/link";
import {useState} from "react";
import {Mail,Copy,ExternalLink} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Modal} from "@/components/ui/modal";
import {getRenewalEmailPreview,type EmailPreviewData} from "./email-actions";
import {renderRenewalEmail,emailHtml} from "./renewal-email";
import {outlookCompose} from "@/lib/domain/renewal";
export function RenewalEmailPreview({certificate,branch,compact=false}:{certificate:string;branch:string;compact?:boolean}) {
  const [open,setOpen]=useState(false),[data,setData]=useState<EmailPreviewData>(),[error,setError]=useState("");
  const [loading,setLoading]=useState(false),[contactId,setContact]=useState("");
  const [mode,setMode]=useState<"official"|"test">("official"),[testTo,setTestTo]=useState("");
  const [copied,setCopied]=useState(false),[confirmed,setConfirmed]=useState(false);
  async function show() {
    setOpen(true);setLoading(true);setError("");setData(undefined);setCopied(false);setConfirmed(false);
    try {
      const result=await getRenewalEmailPreview({certificate,branch});
      if(!result.data) {setError(result.error || "Pratinjau belum tersedia.");return;}
      const d=result.data;setData(d);
      const contact=d.contacts.find(c=>!c.is_test) || (d.isAdmin ? d.contacts[0] : undefined);
      setContact(contact?.id || "");setMode(d.demoMode || contact?.is_test && d.isAdmin ? "test" : "official");setTestTo(d.testRecipients[0] || "");
    } catch {setError("Pratinjau belum dapat dimuat. Periksa akses dan coba kembali.");}
    finally {setLoading(false);}
  }
  const contact=data?.contacts.find(c=>c.id===contactId);
  const effectiveMode=data?.demoMode ? "test" : mode;
  const email=data ? renderRenewalEmail({...data.context,pic:data.demoMode ? data.demoContact.name : contact?.name || ""},data.template,effectiveMode) : null;
  const recipient=data?.demoMode ? data.demoContact.email : effectiveMode === "test" ? testTo : contact?.email || "";
  const recipientVerified=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) && (effectiveMode === "test" ? !!data?.testRecipients.includes(recipient) : contact?.verification_status === "verified" && !contact.is_test);
  async function copy() {
    if(!email) return;
    const text=`Kepada: ${recipient || "Belum tersedia"}\nSubjek: ${email.subject}\n\n${email.body}`;
    try {
      if(typeof ClipboardItem !== "undefined" && navigator.clipboard.write)
        await navigator.clipboard.write([new ClipboardItem({"text/plain":new Blob([text],{type:"text/plain"}),"text/html":new Blob([emailHtml(text)],{type:"text/html"})})]);
      else await navigator.clipboard.writeText(text);
      setCopied(true);setError("");
    } catch {setError("Tidak dapat menyalin otomatis. Pilih teks pratinjau untuk menyalinnya secara manual.");}
  }
  return <>
    <Button type="button" size="sm" variant="outline" className={compact ? "w-full px-1 text-[10px]" : ""} onClick={()=>void show()}><Mail size={14}/> {compact ? "Email perpanjangan" : "Kirim Email Perpanjangan"}</Button>
    <Modal open={open} onOpenChange={setOpen} title="Pratinjau Email Perpanjangan" description="Koordinasi awal kebutuhan layanan; bukan penawaran resmi." size="large" className="renewal-email-preview">
      {loading && <p role="status">Memuat sertifikat dan kontak…</p>}
      {data && email && <div className="grid gap-4 lg:grid-cols-[minmax(250px,340px)_1fr]">
        <div className="space-y-3 text-xs">
          <div className="rounded-lg border border-border bg-slate-50 p-3 leading-6">
            <p className="font-bold text-brand-navy">{data.context.customer}</p><p>Referensi: {data.context.number || "Belum tersedia"}</p>
            <p>Jenis sertifikat: {data.context.certificateType || "Belum tersedia"}</p><p>AM: {data.accountManager}</p>
          </div>
          {data.demoMode && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 leading-5"><strong>Mode Demo · Uji Internal</strong><p>PIC uji: {data.demoContact.name}</p><p>Semua pratinjau demo menggunakan alamat uji Adli. PIC dan email pelanggan wajib dilengkapi saat pengiriman resmi diaktifkan.</p></div>}
          {data.isAdmin && !data.demoMode && <fieldset className="flex gap-4 rounded-lg border border-border p-3"><legend className="px-1">Mode pratinjau</legend>
            {(["official","test"] as const).map(v=><label key={v} className="flex gap-2"><input type="radio" name={"email-mode-"+certificate} checked={mode===v} onChange={()=>{setMode(v);setConfirmed(false);setCopied(false);if(v === "official" && contact?.is_test)setContact(data.contacts.find(c=>!c.is_test)?.id || "");}}/>{v === "test" ? "Uji internal" : "Pelanggan"}</label>)}
          </fieldset>}
          {!data.demoMode && <><label className="grid gap-1">PIC pelanggan
            <select className="min-h-10 rounded-lg border border-input bg-white px-2" value={contactId} onChange={e=>{setContact(e.target.value);setConfirmed(false);setCopied(false);if(data.contacts.find(c=>c.id===e.target.value)?.is_test && data.isAdmin)setMode("test");}}>
              <option value="">PIC belum tersedia</option>{data.contacts.filter(c=>mode === "test" && data.isAdmin || !c.is_test).map(c=><option key={c.id} value={c.id}>{c.name}{c.is_test ? " · Uji internal" : ""}</option>)}
            </select>
          </label>
          <p>Jabatan PIC: {contact?.position || "Belum tercatat"}</p><p>Telepon PIC: {contact?.phone || "Belum tercatat"}</p></>}
          {!data.demoMode && mode === "test" && <label className="grid gap-1">Alamat uji yang diizinkan
            <select className="min-h-10 rounded-lg border border-input bg-white px-2" value={testTo} onChange={e=>{setTestTo(e.target.value);setConfirmed(false);}}><option value="">Belum dikonfigurasi</option>{data.testRecipients.map(v=><option key={v}>{v}</option>)}</select>
          </label>}
          <div className="rounded-lg border border-border p-3 break-words"><strong>Kepada:</strong> {recipient || "Belum tersedia"}<p className={recipientVerified ? "mt-1 text-emerald-800" : "mt-1 text-amber-800"}>{data.demoMode ? "Tujuan uji internal yang diizinkan; bukan PIC resmi pelanggan." : recipientVerified ? "Penerima tercatat dan terverifikasi." : "Penerima belum memenuhi syarat pengiriman."}</p></div>
          <Link href={`/pelanggan/${data.clientId}?branch=${branch}`} className="block text-primary-hover underline">Kelola kontak pelanggan</Link>
          <p className="text-muted-foreground">Template: {data.template.version ? `versi ${data.template.version}` : "standar"}</p>
          {data.isAdmin && <Link href={`/pengaturan/template-email?branch=${branch}`} className="block text-primary-hover underline">Kelola template email</Link>}
        </div>
        <div className="min-w-0 space-y-3">
          <div className="rounded-lg border border-border bg-slate-50 p-3 text-sm"><strong>Subjek:</strong> {email.subject}</div>
          {email.missing.length>0 && <p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{email.missing.join(" · ")}</p>}
          <div className="rounded-lg border border-border bg-white p-4 sm:p-6" aria-label="Isi email" dangerouslySetInnerHTML={{__html:emailHtml(email.body)}}/>
          <p role="status" className="rounded-lg border border-border bg-slate-50 p-3 text-xs leading-5">{data.provider.reason}</p>
          {!data.demoMode && <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={!recipientVerified || email.missing.length>0}/><span>Saya telah memeriksa pelanggan, PIC, alamat penerima, dan isi email. Persetujuan ini belum mengirim email.</span></label>}
          <div className="flex flex-wrap gap-2">
            {email.missing.length === 0 && recipientVerified && (data.demoMode || confirmed) ? (
              <Button asChild><a href={outlookCompose(recipient,email.subject,email.body)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><ExternalLink size={14}/>Buka Draf di Outlook</a></Button>
            ) : <Button type="button" disabled title="Periksa penerima, isi email, dan konfirmasi terlebih dahulu."><ExternalLink size={14}/>Buka Draf di Outlook</Button>}
            <Button type="button" variant="outline" onClick={()=>void copy()} disabled={email.missing.length>0 || !recipientVerified}><Copy size={14}/>{copied ? "Email disalin" : "Salin Email"}</Button>
            {data.isAdmin && <Button type="button" variant="outline" disabled title={data.provider.reason}>Kirim Uji Email</Button>}
            {!data.demoMode && <Button type="button" disabled title={data.provider.reason}>Kirim ke Pelanggan</Button>}
            <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Batal</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Outlook dibuka di tab baru dengan penerima, subjek, dan isi email terisi. Periksa kembali lalu kirim secara manual di Outlook. Membuka draf, pratinjau, atau menyalin email tidak mencatat kontak maupun memindahkan kartu pipeline.</p>
        </div>
      </div>}
      {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    </Modal>
  </>;
}
