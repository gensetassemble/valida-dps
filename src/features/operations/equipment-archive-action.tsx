"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { setRecordsActive } from "@/features/master-data/actions";
import { deleteArchivedEquipment } from "./equipment-delete-action";

export function EquipmentArchiveAction({ id, name, branch, active }: {id:string;name:string;branch:string;active:boolean}) {
  const [open,setOpen] = useState(false);
  const [pending,setPending] = useState(false);
  const [error,setError] = useState<string>();
  const router = useRouter();
  const notify = useToast();
  return <>
    <Button size="sm" variant={active ? "danger" : "outline"} onClick={()=>{setError(undefined);setOpen(true);}}>
      {active ? <Trash2 size={15}/> : <RotateCcw size={15}/>}{active ? "Hapus alat" : "Pulihkan alat"}
    </Button>
    <ConfirmDialog open={open} onOpenChange={setOpen} pending={pending} error={error}
      title={active ? "Hapus alat ke Arsip?" : "Pulihkan alat?"} destructive={active}
      confirmLabel={active ? "Hapus ke Arsip" : "Pulihkan alat"}
      onConfirm={async()=>{
        setPending(true);setError(undefined);
        try {
          const result=await setRecordsActive({entity:"kalibrasi-alat",branch},[id],!active);
          if (!result.ok) {setError(result.error);return;}
          notify(result.message);setOpen(false);
          router.push(`/kalibrasi-alat?branch=${encodeURIComponent(branch)}`);router.refresh();
        } catch {setError("Perubahan belum dapat dikonfirmasi. Refresh untuk memeriksa status alat.");}
        finally {setPending(false);}
      }}>
      <p className="font-semibold">{name}</p>
      <p className="mt-2">{active ? "Alat keluar dari monitoring aktif dan dipindahkan ke Arsip. Riwayat kalibrasi, dokumen, dan pengajuan UMA tetap tersimpan. Jika salah hapus, buka Arsip alat lalu pilih Pulihkan." : "Alat kembali ke daftar dan monitoring aktif. Riwayat tetap terhubung."}</p>
    </ConfirmDialog>
  </>;
}

export function EquipmentPermanentDelete({id,name,branch,updatedAt}: {id:string;name:string;branch:string;updatedAt:string}) {
  const [open,setOpen] = useState(false);
  const [pending,setPending] = useState(false);
  const [error,setError] = useState<string>();
  const [confirmation,setConfirmation] = useState("");
  const router=useRouter();
  const notify=useToast();
  return <>
    <Button size="sm" variant="danger" onClick={()=>{setError(undefined);setConfirmation("");setOpen(true);}}>
      <Trash2 size={15}/>Hapus permanen
    </Button>
    <ConfirmDialog open={open} onOpenChange={setOpen} title="Hapus alat permanen?" destructive
      confirmLabel="Hapus permanen" pending={pending} error={error}
      onConfirm={async()=>{
        if(confirmation!==name){setError("Ketik nama alat persis seperti yang ditampilkan.");return;}
        setPending(true);setError(undefined);
        try {
          const result=await deleteArchivedEquipment({id,branch,updatedAt,confirmed:true});
          if(!result.ok){setError(result.error);return;}
          notify(result.message);setOpen(false);
          router.push(`/kalibrasi-alat?branch=${encodeURIComponent(branch)}&active=false`);router.refresh();
        } catch {setError("Penghapusan belum dapat dikonfirmasi. Refresh untuk memeriksa data alat.");}
        finally {setPending(false);}
      }}>
      <p>Alat <strong>{name}</strong> akan dihapus dan tidak dapat dipulihkan. Penghapusan ditolak jika masih memiliki riwayat kalibrasi, pengajuan UMA, atau dokumen. Jejak audit tetap disimpan.</p>
      <label className="mt-4 block font-semibold">Ketik nama alat untuk mengonfirmasi
        <input className="mt-2 block w-full rounded-lg border border-border p-3 font-normal" autoComplete="off" value={confirmation} onChange={event=>setConfirmation(event.target.value)}/>
      </label>
    </ConfirmDialog>
  </>;
}
