"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, MessageSquareText, Plus, Send, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/format";
import { EvidenceForm } from "@/features/operations/forms";
import { loadQcPosts, loadQcThreads, loadQcThread, submitQc } from "./actions";
import { QC_EVENTS, QC_STATUSES, type QcThread, type QcPost, type QcDomain } from "./model";
import { QcFindingsForm } from "./findings-form";

type Props={branch:string;domain:QcDomain;record:string;reviewer:boolean;responder:boolean;initial:{threads:QcThread[];total:number};documents:{id:string;name:string}[]};
export function QcConversations(props:Props) {
  const {branch,domain,record,initial,reviewer}=props;
  const [selected,setSelected]=useState<string|null>(null),[creating,setCreating]=useState(false),[extra,setExtra]=useState<QcThread[]>([]),[page,setPage]=useState(0);
  const [error,setError]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
  const router=useRouter();
  const threads=[...initial.threads,...extra.filter(t=>!initial.threads.some(i=>i.id===t.id))];
  useEffect(()=>{
    let active=true;
    function openTarget(){
      const match=window.location.hash.match(/^#qc-([0-9a-f-]{36})$/i);
      if(!match)return;
      setSelected(match[1]);
      void loadQcThread({branch,domain,record},match[1]).then(t=>{
        if(active && t){setExtra(old=>[...old.filter(x=>x.id!==t.id),t]);
          requestAnimationFrame(()=>document.getElementById("qc-"+t.id)?.scrollIntoView({block:"center"}));}
      }).catch(()=>{if(active)setError("Temuan belum dapat dibuka. Muat ulang untuk mencoba kembali.");});
    }
    openTarget();window.addEventListener("hashchange",openTarget);
    return()=>{active=false;window.removeEventListener("hashchange",openTarget);};
  },[branch,domain,record]);
  return <section id={"catatan-qc-"+record} aria-label="Catatan QC sertifikat" className="mb-3 overflow-hidden rounded-xl border border-teal-200 bg-white shadow-sm">
    <header className="flex flex-wrap items-start justify-between gap-2 border-b border-teal-100 bg-gradient-to-r from-teal-50 to-white p-3">
      <div className="flex items-start gap-2"><span className="rounded-lg bg-teal-100 p-2 text-teal-800"><ShieldCheck size={18}/></span><div><h2 className="text-sm font-bold">Catatan QC <span className="ml-1 text-xs font-medium text-muted-foreground">{initial.total} temuan</span></h2><p className="mt-0.5 text-xs leading-snug text-muted-foreground">Temuan dan tindak lanjut sertifikat.</p></div></div>
      {reviewer && <Button size="sm" variant="outline" disabled={busy} onClick={()=>setCreating(v=>!v)}><Plus size={15}/>{creating?"Tutup isian":"Tambah catatan QC"}</Button>}
    </header>
    <div className="space-y-2 p-3">
      {creating && <QcFindingsForm branch={branch} domain={domain} record={record} onBusyChange={setBusy} onCreated={ids=>{
        setCreating(false);setSelected(ids[0]);setError("");
        setNotice(`${ids.length} poin temuan dikirim. Setiap poin dapat ditindaklanjuti terpisah.`);router.refresh();
      }}/>}
      {notice && <p role="status" className="rounded-lg bg-teal-50 p-3 text-xs text-teal-900">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!threads.length && !creating && <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground"><MessageSquareText size={20}/><p>Belum ada catatan QC untuk sertifikat ini.</p></div>}
      {threads.map(t=><div key={t.id} id={"qc-"+t.id} className="scroll-mt-24 overflow-hidden rounded-xl border border-border">
        <button type="button" aria-expanded={selected===t.id} aria-controls={"qc-body-"+t.id} onClick={()=>setSelected(selected===t.id?null:t.id)} className="flex w-full items-center justify-between gap-2 bg-slate-50/60 px-3 py-2.5 text-left">
          <span className="min-w-0"><span className="block break-words text-sm font-semibold">{t.title}</span><span className="mt-1 block text-[11px] text-muted-foreground">{formatTimestamp(t.updated_at)}</span></span>
          <span className="flex shrink-0 items-center gap-2"><QcStatus status={t.status}/><ChevronDown size={15} className={selected===t.id?"rotate-180":""}/></span>
        </button>
        {selected===t.id && <div id={"qc-body-"+t.id}><Conversation key={t.id+":"+t.version} {...props} thread={t}/></div>}
      </div>)}
      {threads.length<initial.total && <Button size="sm" variant="outline" disabled={busy} onClick={async()=>{setBusy(true);try{const next=await loadQcThreads({branch,domain,record},page+1);setExtra(old=>[...old,...next.threads.filter(t=>!old.some(i=>i.id===t.id))]);setPage(page+1);}catch{setError("Daftar berikutnya belum dapat dimuat.");}finally{setBusy(false);}}}>Muat temuan lainnya</Button>}
    </div>
  </section>;
}
function QcStatus({status}:{status:QcThread["status"]}){
  const tone=status==="closed"?"bg-emerald-50 text-emerald-800":status==="awaiting_qshe"?"bg-violet-50 text-violet-800":status==="in_progress"?"bg-blue-50 text-blue-800":"bg-amber-50 text-amber-900";
  return <span className={"rounded-full px-2.5 py-1 text-[11px] font-semibold "+tone}>{QC_STATUSES[status]}</span>;
}
function Conversation({thread,branch,domain,record,reviewer,responder,documents}:Props & {thread:QcThread}){
  const [posts,setPosts]=useState<QcPost[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(0),[loading,setLoading]=useState(true);
  const [body,setBody]=useState(""),[evidence,setEvidence]=useState(""),[upload,setUpload]=useState(false),[added,setAdded]=useState<{id:string;name:string}[]>([]);
  const [error,setError]=useState(""),[pending,start]=useTransition(),[reopening,setReopening]=useState(false);
  const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
  const router=useRouter();
  useEffect(()=>{let active=true;void loadQcPosts(thread.id).then(r=>{if(active){setPosts(r.posts);setTotal(r.total);}}).catch(()=>{if(active)setError("Percakapan belum dimuat. Tutup lalu buka kembali untuk mencoba lagi.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[thread.id]);
  function send(operation:"reply"|"request_review"|"close"|"reopen"){
    start(async()=>{
      setError("");
      try{
        const result=await submitQc({branch,domain,record,thread:thread.id,operation,body,title:"",version:thread.version,requestId,evidence:evidence||null});
        if(result.error){setError(result.error);return;}
        setRequestId(crypto.randomUUID());setBody("");router.refresh();
      }catch{setError("Koneksi terputus. Coba kirim kembali; tindakan yang sama tidak akan digandakan.");}
    });
  }
  const canReply=reviewer||responder;
  return <div className="space-y-3 p-3">
    {!!thread.recipient_names.length && <p className="text-[11px] text-muted-foreground">Pemberitahuan terakhir diteruskan ke: {thread.recipient_names.join(", ")}</p>}
    {loading?<p role="status" className="text-sm text-muted-foreground">Memuat percakapan…</p>:<>
      {posts.length<total && <Button size="sm" variant="outline" onClick={async()=>{setLoading(true);try{const r=await loadQcPosts(thread.id,page+1);setPosts(old=>[...r.posts,...old]);setPage(page+1);}catch{setError("Pesan sebelumnya belum dimuat.");}finally{setLoading(false);}}}>Lihat pesan sebelumnya</Button>}
      <ol className="max-h-[28rem] space-y-3 overflow-y-auto overscroll-contain pr-1" aria-label="Percakapan QC">
        {posts.map(p=><li key={p.id} className="rounded-xl bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2 text-xs"><strong>{p.author_name}</strong><time className="text-[10px] text-muted-foreground" dateTime={p.created_at}>{formatTimestamp(p.created_at)}</time></div><p className="mt-1 text-[10px] font-medium text-teal-800">{QC_EVENTS[p.operation]}</p>{p.body && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{p.body}</p>}{p.document_id && <a target="_blank" rel="noopener noreferrer" href={"/api/documents?id="+p.document_id} className="mt-2 inline-block text-xs font-semibold text-primary underline">Lihat lampiran sertifikat</a>}</li>)}
      </ol>
    </>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-800">{error} <button className="underline" onClick={()=>router.refresh()}>Muat ulang</button></p>}
    {canReply && (thread.status!=="closed" || reopening) && <div className="space-y-3 rounded-xl border border-border p-3">
      <label className="block text-xs font-semibold">{reopening?"Apa yang masih perlu diperbaiki?":"Balasan"}<textarea aria-label={reopening?"Alasan membuka kembali":"Balasan catatan QC"} value={body} onChange={e=>setBody(e.target.value)} rows={3} maxLength={4000} placeholder="Tulis tanggapan atau perkembangan perbaikan…" className="mt-1 w-full rounded-lg border border-input p-3 text-sm font-normal"/></label>
      {!reopening && responder && <><div className="flex flex-wrap items-center gap-2"><label className="flex-1 text-xs">Lampiran sertifikat (opsional)<select value={evidence} onChange={e=>setEvidence(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-input px-2"><option value="">Tanpa lampiran</option>{[...documents,...added.filter(d=>!documents.some(x=>x.id===d.id))].map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><Button type="button" size="sm" variant="outline" onClick={()=>setUpload(!upload)}>{upload?"Tutup unggahan":"Unggah revisi PDF"}</Button></div>{upload && <EvidenceForm domain={domain} id={record} branch={branch} onUploaded={d=>{setAdded(old=>[...old,{id:d.id,name:d.original_name}]);setEvidence(d.id);setUpload(false);}}/>}</>}
      <div className="flex flex-wrap gap-2">{reopening?<Button size="sm" disabled={pending||!body.trim()} onClick={()=>send("reopen")}><RotateCcw size={14}/>Buka kembali</Button>:<><Button size="sm" disabled={pending||!body.trim()} onClick={()=>send("reply")}><Send size={14}/>{pending?"Menyimpan…":"Kirim balasan"}</Button>{responder && thread.status!=="awaiting_qshe" && <Button size="sm" variant="outline" disabled={pending} onClick={()=>send("request_review")}><ShieldCheck size={14}/>Minta cek QSHE</Button>}</>}</div>
    </div>}
    {reviewer && <div className="flex items-center justify-between gap-3 border-t border-border pt-3"><p className="text-[11px] text-muted-foreground">{thread.status==="closed"?"Riwayat percakapan tetap tersimpan.":"Selesaikan setelah perbaikan sudah sesuai."}</p>{thread.status==="closed"?<Button size="sm" variant="outline" disabled={pending} onClick={()=>setReopening(!reopening)}><RotateCcw size={14}/>{reopening?"Batal":"Buka kembali"}</Button>:<Button size="sm" variant="outline" disabled={pending} onClick={()=>send("close")}><CheckCircle2 size={14}/>Selesaikan temuan</Button>}</div>}
  </div>;
}
