"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {manageEmailDelivery} from "./actions";
export function DeliveryControls({branch,job,state,code}:{branch:string;job:string;state:string;code:string|null}) {
  const [open,setOpen]=useState(false),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");const router=useRouter();
  const retry=state === "failed" && ["MAILBOX_AUTHORIZATION_REQUIRED","TOKEN_UNAVAILABLE","GRAPH_401","GRAPH_403","GRAPH_THROTTLED","INTEGRATION_DISABLED","COMMERCIAL_DISABLED","REMINDERS_DISABLED","LIVE_MODE_REQUIRED"].includes(code || "") || state === "cancelled" && code === "ADMIN_CANCELLED";
  if(state !== "pending" && !retry)return null;
  return <div className="mt-2 space-y-2">{open ? <form onSubmit={async e=>{e.preventDefault();setBusy(true);try{const r=await manageEmailDelivery({branch,job,operation:retry?"retry":"cancel",reason});if(r.error)setError(r.error);else{setOpen(false);router.refresh();}}catch{setError("Perubahan belum dapat dikonfirmasi. Muat ulang riwayat.");}finally{setBusy(false);}}} className="min-w-52 space-y-2">
    <Input aria-label="Alasan tindakan antrean" required minLength={8} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Alasan tindakan…"/>
    <Button size="sm" disabled={busy}>Konfirmasi {retry?"antre ulang":"pembatalan"}</Button><Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Tutup</Button>{error&&<p role="alert">{error}</p>}
  </form> : <Button size="sm" variant="outline" onClick={()=>setOpen(true)}>{retry?"Antre ulang setelah koreksi":"Batalkan antrean"}</Button>}</div>;
}
