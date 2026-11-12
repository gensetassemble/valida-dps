"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
type Outcome={sheet:string;row:number;name:string;tag:string;equipment_id:string;equipment:string;calibration:string};
type Result={error?:string;issues?:string[];rows?:Outcome[];ignored?:string[]};
const actions:Record<string,string>={added:'Ditambahkan',updated:'Diperbarui',unchanged:'Tetap',none:'Tidak ada peristiwa'};
export function EquipmentImportButton({branch}:{branch:string}){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[result,setResult]=useState<Result|null>(null);
  const router=useRouter();
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setResult(null);
    try{const response=await fetch('/api/operations/equipment-import',{method:'POST',body:new FormData(event.currentTarget)});const value=await response.json();setResult(value);if(response.ok)router.refresh();}
    catch{setResult({error:'Koneksi terputus. Unggah ulang file yang sama untuk memeriksa hasil; peristiwa yang sama tidak dibuat ganda.'});}
    finally{setBusy(false);}
  }
  const changed=result?.rows?.filter(r=>r.equipment!=='unchanged'||['added','updated'].includes(r.calibration)).length||0;
  return <><Button variant="outline" onClick={()=>setOpen(true)}><Upload/>Impor Excel / CSV</Button>
    <Modal open={open} onOpenChange={value=>{if(!busy)setOpen(value);}} title="Impor pembaruan alat · UMA/198" description="Unggah laporan monitoring terbaru. Sekali proses untuk memperbarui alat, keterangan, serta riwayat kalibrasi." size="large">
      <form onSubmit={submit} className="space-y-4">
        <input type="hidden" name="branch" value={branch}/>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold">File laporan monitoring<Input type="file" name="file" accept=".xlsx,.csv" required disabled={busy}/><span className="block text-xs font-normal text-muted-foreground">XLSX / CSV, maksimum 4 MiB dan 250 baris alat/peristiwa. Simpan XLS lama sebagai XLSX.</span></label>
          <label className="space-y-2 text-sm font-semibold">Portofolio jika tidak tercantum dalam file<select name="portfolio" disabled={busy} className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm"><option value="">Otomatis dari kolom / nama sheet</option>{['IND','PIK','SERCO','KSP','HMPM','AEBT','LAB','MIN','BBR','LSI'].map(p=><option key={p}>{p}</option>)}</select><span className="block text-xs font-normal text-muted-foreground">Satu workbook dapat berisi beberapa sheet portofolio.</span></label>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs leading-6">
          <p className="font-semibold">Gunakan kolom laporan FOR/SCI-UMA/198 yang sama dengan hasil ekspor.</p>
          <p>Nama Barang dan Tag-Number wajib diisi. Cell kosong mempertahankan data yang ada; tulis [KOSONGKAN] pada keterangan bila ingin menghapusnya. Sertifikat baru wajib memiliki tanggal terbit.</p>
          <p>Alat dicocokkan dengan portofolio, tag, nama, dan nomor seri. Sertifikat baru ditambahkan ke riwayat; sertifikat yang sama diperbarui. Tidak mengarsipkan alat yang absen dari file.</p>
          <p>Jika ada data ambigu atau tidak valid, seluruh impor dibatalkan dan letak kesalahannya ditampilkan. Tidak perlu menyetujui setiap baris.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" asChild><a href={`/api/operations/export?entity=kalibrasi-alat&branch=${encodeURIComponent(branch)}`}>Unduh format UMA saat ini</a></Button><Button type="submit" disabled={busy}>{busy?<LoaderCircle className="animate-spin"/>:<Upload/>}{busy?'Memproses file…':'Impor & Perbarui'}</Button></div>
      </form>
      {result&&<div className="mt-5" aria-live="polite">
        {result.error?<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p className="font-semibold">{result.error}</p><ul className="mt-2 max-h-60 list-disc overflow-y-auto pl-5 text-xs leading-6">{result.issues?.map((issue,i)=><li key={i}>{issue}</li>)}</ul></div>:<>
          <p className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"><CheckCircle2/>{new Set(result.rows?.map(r=>r.equipment_id)).size} alat · {result.rows?.length} baris diproses · {changed} berubah · {(result.rows?.length||0)-changed} tetap</p>
          {!!result.ignored?.length&&<p className="mt-2 text-xs text-muted-foreground">Sheet diabaikan (ringkasan/arsip/bukan tabel UMA): {result.ignored.join(', ')}.</p>}
          <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-muted"><tr>{['Alat / Tag','Sheet / Baris','Data alat','Peristiwa kalibrasi'].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{result.rows?.map((r,i)=><tr key={i} className="border-t border-border"><td className="p-3 font-medium">{r.name}<span className="block text-muted-foreground">{r.tag}</span></td><td className="p-3">{r.sheet} / {r.row}</td><td className="p-3">{actions[r.equipment]}</td><td className="p-3">{actions[r.calibration]}</td></tr>)}</tbody></table></div>
        </>}
      </div>}
    </Modal></>;
}
