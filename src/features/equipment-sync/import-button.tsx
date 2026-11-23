"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  CheckCircle2,
  LoaderCircle,
  FileSpreadsheet,
  ScanSearch,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
type Change={field:string;label:string;before:string|null;after:string|null};
type Outcome={sheet:string;row:number;name:string;tag:string;equipment_id:string;equipment:string;calibration:string;match?:string;reviewKey?:string;changes?:Change[];requiresReview?:boolean};
type Result={phase?:'preview'|'applied';fileHash?:string;error?:string;issues?:string[];rows?:Outcome[];ignored?:string[];duplicates?:number};
const actions:Record<string,string>={added:'Ditambahkan',updated:'Diperbarui',unchanged:'Tetap',none:'Tidak ada peristiwa'};
const matches:Record<string,string>={new:'Alat baru',tag_serial:'Tag + nomor seri',tag_name:'Tag + nama',tag_name_missing_serial:'Tag + nama; lengkapi nomor seri'};
export function EquipmentImportButton({branch}:{branch:string}){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[result,setResult]=useState<Result|null>(null),[reviews,setReviews]=useState<Record<string,string>>({});
  const router=useRouter();
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);
    const form=new FormData(event.currentTarget),submitter=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
    const operation=submitter?.value==='apply'?'apply':'preview';form.set('operation',operation);
    if(operation==='preview')setResult(null);
    if(operation==='apply'){form.set('fileHash',result?.fileHash||'');form.set('reviews',JSON.stringify(reviews));}
    try{const response=await fetch('/api/operations/equipment-import',{method:'POST',body:form});const value=await response.json();setResult(value);if(response.ok&&value.phase==='applied')router.refresh();}
    catch{setResult({error:'Koneksi terputus. Unggah ulang file yang sama untuk memeriksa hasil; peristiwa yang sama tidak dibuat ganda.'});}
    finally{setBusy(false);}
  }
  const changed=result?.rows?.filter(r=>r.equipment!=='unchanged'||['added','updated'].includes(r.calibration)).length||0;
  const missingReview=result?.phase==='preview'&&result.rows?.some(row=>row.requiresReview&&!reviews[row.reviewKey||'']);
  return <><Button variant="outline" onClick={()=>setOpen(true)}><Upload/>Impor Excel / CSV</Button>
    <Modal open={open} onOpenChange={value=>{if(!busy)setOpen(value);}} title="Impor pembaruan alat · UMA/198" description="Unggah laporan monitoring terbaru. Sekali proses untuk memperbarui alat, keterangan, serta riwayat kalibrasi." size="large">
      <form id="equipment-import-form" onSubmit={submit} className="space-y-4">
        <input type="hidden" name="branch" value={branch}/>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold">File laporan monitoring<Input type="file" name="file" accept=".csv,.xlsx,.xls,.xlsb" required disabled={busy} onChange={()=>{setResult(null);setReviews({});}}/><span className="block text-xs font-normal text-muted-foreground">CSV / XLSX / XLS / XLSB, maksimum 4 MiB dan 250 baris alat/peristiwa.</span></label>
          <label className="space-y-2 text-sm font-semibold">Portofolio jika tidak tercantum dalam file<select name="portfolio" disabled={busy} className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm"><option value="">Otomatis dari kolom / nama sheet</option>{['IND','PIK','SERCO','KSP','HMPM','AEBT','LAB','MIN','BBR','LSI'].map(p=><option key={p}>{p}</option>)}</select><span className="block text-xs font-normal text-muted-foreground">Satu workbook dapat berisi beberapa sheet portofolio.</span></label>
        </div>
        <section className="overflow-hidden rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50/80 via-white to-sky-50/70">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-teal-100 px-4 py-3">
            <div>
              <p className="font-semibold text-brand-navy">Cara kerja impor</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Laporan UMA/198 dari PTK atau hasil ekspor VALIDA dapat langsung dibaca.
              </p>
            </div>
            <span className="rounded-full bg-teal-100 px-3 py-1 text-[11px] font-semibold text-teal-800">
              Fleksibel &amp; aman
            </span>
          </div>

          <div className="grid gap-3 p-4 text-xs sm:grid-cols-2">
            <div className="rounded-xl border border-white bg-white/90 p-3 shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-brand-navy">
                <span className="grid size-8 place-items-center rounded-lg bg-sky-100 text-sky-700">
                  <FileSpreadsheet className="size-4" />
                </span>
                Siapkan data wajib
              </div>
              <ul className="mt-2.5 list-disc space-y-1 pl-4 leading-5 text-muted-foreground marker:text-sky-500">
                <li><strong className="text-foreground">Nama Barang</strong> dan <strong className="text-foreground">Tag-Number</strong> wajib diisi.</li>
                <li>Sertifikat baru wajib memiliki tanggal terbit.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-white bg-white/90 p-3 shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-brand-navy">
                <span className="grid size-8 place-items-center rounded-lg bg-violet-100 text-violet-700">
                  <ScanSearch className="size-4" />
                </span>
                Pencocokan otomatis
              </div>
              <ul className="mt-2.5 list-disc space-y-1 pl-4 leading-5 text-muted-foreground marker:text-violet-500">
                <li>Susunan kolom, spasi, header, dan nama sheet boleh berbeda.</li>
                <li>Sistem mencocokkan portofolio, tag, dan nomor seri agar alat tidak tercatat ganda.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-white bg-white/90 p-3 shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-brand-navy">
                <span className="grid size-8 place-items-center rounded-lg bg-amber-100 text-amber-700">
                  <RefreshCw className="size-4" />
                </span>
                Data diperbarui dengan aman
              </div>
              <ul className="mt-2.5 list-disc space-y-1 pl-4 leading-5 text-muted-foreground marker:text-amber-500">
                <li>Cell kosong mempertahankan data lama. Tulis <code className="rounded bg-amber-100 px-1 font-semibold text-amber-900">[KOSONGKAN]</code> pada keterangan untuk menghapusnya.</li>
                <li>Alat baru ditambahkan, sertifikat masuk ke riwayat, dan alat yang tidak ada di file tetap disimpan.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-white bg-white/90 p-3 shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-brand-navy">
                <span className="grid size-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="size-4" />
                </span>
                Duplikat &amp; konflik terkendali
              </div>
              <ul className="mt-2.5 list-disc space-y-1 pl-4 leading-5 text-muted-foreground marker:text-emerald-500">
                <li>Baris identik dilewati; sertifikat katup yang berbeda tetap dipisahkan dalam satu alat.</li>
                <li>Jika data ambigu atau bertentangan, impor dibatalkan dan lokasi kesalahan ditampilkan.</li>
              </ul>
            </div>
          </div>

          <p className="border-t border-teal-100 px-4 py-3 text-xs font-medium text-teal-800">
            File diperiksa lebih dahulu. Data website baru berubah setelah hasil pemeriksaan dikonfirmasi.
          </p>
        </section>
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" asChild><a href={`/api/operations/export?entity=kalibrasi-alat&branch=${encodeURIComponent(branch)}`}>Unduh format UMA saat ini</a></Button><Button type="submit" name="operation" value="preview" disabled={busy}>{busy?<LoaderCircle className="animate-spin"/>:<ScanSearch/>}{busy?'Memeriksa file…':'Periksa & Tampilkan Perubahan'}</Button></div>
      </form>
      {result&&<div className="mt-5" aria-live="polite">
        {result.error?<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p className="font-semibold">{result.error}</p><ul className="mt-2 max-h-60 list-disc overflow-y-auto pl-5 text-xs leading-6">{result.issues?.map((issue,i)=><li key={i}>{issue}</li>)}</ul></div>:<>
          <p className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"><CheckCircle2/>{new Set(result.rows?.map(r=>r.equipment_id)).size} alat · {result.rows?.length} baris diperiksa · {changed} berubah · {(result.rows?.length||0)-changed} tetap</p>
          {!!result.ignored?.length&&<p className="mt-2 text-xs text-muted-foreground">Sheet diabaikan (ringkasan/arsip/bukan tabel UMA): {result.ignored.join(', ')}.</p>}
          {!!result.duplicates&&<p className="mt-2 text-xs text-muted-foreground">{result.duplicates} baris duplikat identik dilewati.</p>}
          <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-border"><table className="w-full text-left text-xs"><thead className="sticky top-0 z-10 bg-muted"><tr>{['Alat / sumber','Hasil pencocokan','Perubahan sensitif','Alasan perubahan'].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{result.rows?.map((r,i)=><tr key={r.reviewKey||i} className="border-t border-border align-top"><td className="p-3 font-medium">{r.name}<span className="block text-muted-foreground">{r.tag} · {r.sheet} / {r.row}</span></td><td className="p-3">{matches[r.match||'']||'Identitas alat'}<span className="mt-1 block text-muted-foreground">Alat: {actions[r.equipment]} · Kalibrasi: {actions[r.calibration]}</span></td><td className="min-w-64 p-3">{r.changes?.length?r.changes.map(change=><div key={change.field} className="mb-2"><span className="font-semibold">{change.label}</span><span className="block text-muted-foreground">{change.before||'Belum tercatat'} → {change.after||'Dikosongkan'}</span></div>):<span className="text-muted-foreground">Tidak ada perubahan nomor/tanggal.</span>}</td><td className="min-w-56 p-3">{result.phase==='preview'&&r.requiresReview?<select aria-label={`Alasan perubahan ${r.name}`} value={reviews[r.reviewKey||'']||''} onChange={event=>setReviews(current=>({...current,[r.reviewKey||'']:event.target.value}))} className="h-10 w-full rounded-lg border border-input bg-white px-2"><option value="">Pilih alasan…</option><option value="calibration_event">Kalibrasi / sertifikat baru</option><option value="data_correction">Koreksi data, bukan kalibrasi</option></select>:<span className="text-muted-foreground">Tidak perlu klasifikasi</span>}</td></tr>)}</tbody></table></div>
          {result.phase==='preview'&&<div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-950">Belum ada perubahan yang disimpan.</p><p className="mt-1 text-xs text-amber-900">Periksa perubahan nomor dan tanggal, lalu pilih penyebabnya sebelum menerapkan.</p><div className="mt-3 flex justify-end"><Button form="equipment-import-form" type="submit" name="operation" value="apply" disabled={busy||Boolean(missingReview)}>{busy?<LoaderCircle className="animate-spin"/>:<Upload/>}{busy?'Menerapkan…':'Konfirmasi & Terapkan ke Database'}</Button></div></div>}
          {result.phase==='applied'&&<p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Pembaruan telah diterapkan dan hasil pemeriksaan tersimpan di riwayat aktivitas.</p>}
        </>}
      </div>}
    </Modal></>;
}
