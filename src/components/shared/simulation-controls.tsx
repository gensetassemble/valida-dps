"use client";
import {useEffect,useState} from "react";
import {Button} from "@/components/ui/button";
import {useToast} from "@/components/ui/toast";
import {FlaskConical,LogOut} from "lucide-react";
export function SimulationControls({active}:{active:boolean}){
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const notify=useToast();
  useEffect(()=>{
    if(!active)return;
    const stopExternalMail=(event:MouseEvent)=>{
      const link=event.target instanceof Element?event.target.closest("a"):null;
      if(!link)return;
      const url=new URL(link.href,window.location.href);
      if(url.protocol==="mailto:" || (/^outlook\.(office|live)\.com$/.test(url.hostname) && url.pathname.includes("compose"))){
        event.preventDefault();event.stopPropagation();
        notify("Simulasi draf berhasil. Outlook tidak dibuka dan email sungguhan tidak dikirim.");
      }
    };
    document.addEventListener("click",stopExternalMail,true);
    return()=>document.removeEventListener("click",stopExternalMail,true);
  },[active,notify]);
  return <aside className={active?"fixed inset-x-0 bottom-0 z-[90] flex flex-wrap items-center justify-center gap-3 border-t border-amber-300 bg-amber-100 px-4 py-2 text-xs text-amber-950":"fixed bottom-5 right-5 z-[90] rounded-xl border border-border bg-white p-2 shadow-lg"}>
    {active && <strong>MODE SIMULASI · Data latihan terpisah · Profil/peran latihan tidak memberi login nyata · Email tidak dikirim</strong>}
    <Button size="sm" variant={active?"outline":"default"} disabled={busy} onClick={async()=>{
      setBusy(true);setError("");try{
        const response=await fetch("/api/simulation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:!active})});
        const result=await response.json();if(!response.ok){setError(result.error||"Mode belum dapat diganti.");setBusy(false);return;}
        window.location.assign(result.href);
      }catch{setError("Koneksi terputus. Coba kembali.");setBusy(false);}
    }}>{active?<LogOut size={15}/>:<FlaskConical size={15}/>} {busy?"Memuat…":active?"Keluar simulasi":"Mode Simulasi"}</Button>
    {error&&<p role="alert">{error}</p>}
  </aside>;
}
