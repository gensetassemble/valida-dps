import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { entityContext, masterClient } from "@/features/master-data/server";
import { boundedForm } from "@/lib/http/bounded-form";
import { parseUma, UmaImportError } from "@/features/equipment-sync/parser";
import {
  buildEquipmentImportPreview,
  type CurrentCalibration,
  type EquipmentSyncOutcome,
} from "@/features/equipment-sync/review";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers={"Cache-Control":"private, no-store"};
const reviewValues = new Set(["calibration_event", "data_correction"]);
function databaseIssues(error:{code?:string;message?:string}) {
  if(error.code==='P0001')return (error.message||'Data file perlu diperiksa.').split('\n');
  if(['57014','55P03'].includes(error.code||''))return ['Proses melewati batas waktu atau masih ada impor lain yang berjalan. Coba kembali atau bagi file per portofolio.'];
  if(error.code==='42501')return ['Akun belum mendapat kewenangan impor pada cabang/portofolio ini. Login ulang, selesaikan MFA, lalu pastikan akun memiliki peran Admin, PTK, atau Koordinator terkait.'];
  if(error.code==='23503')return ['Referensi cabang, portofolio, alat, atau akun pada data sumber tidak ditemukan.'];
  return ['Pratinjau ditolak oleh validasi database. Muat ulang halaman lalu coba kembali; bila berulang, sampaikan waktu kejadian kepada IT.'];
}
export async function POST(request:NextRequest){
  if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Permintaan tidak diizinkan.'},{status:403,headers});
  try{
    const form=await boundedForm(request,4*1024*1024);
    const branch=String(form.get('branch')||'');
    const c=await entityContext('kalibrasi-alat',branch,true);
    const file=form.get('file');if(!(file instanceof File))throw new UmaImportError(['Pilih file CSV, XLSX, XLS, atau XLSB.']);
    const fallback=String(form.get('portfolio')||'');
    if(fallback&&!/^(IND|PIK|SERCO|KSP|HMPM|AEBT|LAB|MIN|BBR|LSI)$/.test(fallback))throw new UmaImportError(['Portofolio file tidak valid.']);
    const parsed=await parseUma(file.name,Buffer.from(await file.arrayBuffer()),fallback);
    const db=await masterClient();
    const input={b:c.branch,filename:file.name.replace(/[^\p{L}\p{N} ._()-]/gu,'_').slice(0,180),filehash:parsed.hash,items:parsed.rows};
    const {data:previewData,error:previewError}=await db.rpc('preview_equipment_uma',input);
    if(previewError){console.error('Equipment import preview failed',{code:previewError.code});return NextResponse.json({error:'Pratinjau dibatalkan; belum ada perubahan yang disimpan.',issues:databaseIssues(previewError)},{status:422,headers});}
    const outcomes=(previewData?.rows||[]) as EquipmentSyncOutcome[];
    const equipmentIds=[...new Set(outcomes.filter(row=>row.equipment!=='added').map(row=>row.equipment_id))];
    let current:CurrentCalibration[]=[];
    if(equipmentIds.length){
      const {data:currentData,error:currentError}=await db.from('current_equipment_calibrations').select('equipment_id,component_label,certificate_number,issue_date,due_date').in('equipment_id',equipmentIds);
      if(currentError)return NextResponse.json({error:'Data pembanding belum dapat dimuat; belum ada perubahan yang disimpan.'},{status:422,headers});
      current=(currentData||[]) as CurrentCalibration[];
    }
    const preview=buildEquipmentImportPreview(parsed.rows,outcomes,current);
    if(String(form.get('operation')||'preview')!=='apply')return NextResponse.json({phase:'preview',fileHash:parsed.hash,rows:preview,ignored:parsed.ignored,duplicates:parsed.duplicates},{headers});
    if(String(form.get('fileHash')||'')!==parsed.hash)return NextResponse.json({error:'File berubah setelah pratinjau. Periksa ulang file terbaru.'},{status:409,headers});
    let reviews:Record<string,string>={};
    try{reviews=JSON.parse(String(form.get('reviews')||'{}'));}catch{return NextResponse.json({error:'Hasil screening tidak valid. Periksa ulang file.'},{status:400,headers});}
    const missing=preview.filter(row=>row.requiresReview&&!reviewValues.has(reviews[row.reviewKey]));
    if(missing.length)return NextResponse.json({error:'Pilih alasan perubahan nomor sertifikat/tanggal sebelum menerapkan impor.',issues:missing.slice(0,20).map(row=>`${row.sheet} baris ${row.row}: ${row.name} (${row.tag})`)},{status:422,headers});
    const reviewedRows=parsed.rows.map((row,index)=>{
      const result=preview.find(item=>item.sheet===row.sheet&&item.row===row.row)||preview[index];
      return {...row,review:{classification:result?.requiresReview?reviews[result.reviewKey]:'no_sensitive_change',changes:result?.changes||[],reviewed_at:new Date().toISOString()}};
    });
    const {data,error}=await db.rpc('apply_equipment_uma_reviewed',{
      b:c.branch,filename:file.name.replace(/[^\p{L}\p{N} ._()-]/gu,'_').slice(0,180),filehash:parsed.hash,items:reviewedRows,
    });
    if(error){console.error('Equipment import apply failed',{code:error.code});return NextResponse.json({error:'Impor dibatalkan seluruhnya; belum ada perubahan yang disimpan.',issues:databaseIssues(error)},{status:422,headers});}
    for(const path of ['/kalibrasi-alat','/dashboard','/master-data/alat'])revalidatePath(path);
    revalidatePath('/kalibrasi-alat/[id]','page');revalidatePath('/peristiwa-kalibrasi/[id]','page');
    return NextResponse.json({...data,phase:'applied',ignored:parsed.ignored,duplicates:parsed.duplicates},{headers});
  }catch(error){
    return NextResponse.json({error:error instanceof UmaImportError?error.message:'Impor belum dapat diproses. Periksa file, ukuran maksimum 4 MiB, dan hak akses.',issues:error instanceof UmaImportError?error.issues:[]},{status:400,headers});
  }
}
export async function GET(request:NextRequest){
  try{
    const c=await entityContext('kalibrasi-alat',request.nextUrl.searchParams.get('branch')||undefined,true);
    const db=await masterClient();const {data,error}=await db.from('equipment_sync_runs').select('id,source_name,created_at').eq('branch_code',c.branch).order('created_at',{ascending:false}).limit(10);
    if(error)throw error;return NextResponse.json({runs:data},{headers});
  }catch{return NextResponse.json({error:'Riwayat impor belum dapat dimuat.'},{status:403,headers});}
}
