import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { entityContext, masterClient } from "@/features/master-data/server";
import { boundedForm } from "@/lib/http/bounded-form";
import { parseUma, UmaImportError } from "@/features/equipment-sync/parser";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers={"Cache-Control":"private, no-store"};
export async function POST(request:NextRequest){
  if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Permintaan tidak diizinkan.'},{status:403,headers});
  try{
    const form=await boundedForm(request,4*1024*1024);
    const branch=String(form.get('branch')||'');
    const c=await entityContext('kalibrasi-alat',branch,true);
    const file=form.get('file');if(!(file instanceof File))throw new UmaImportError(['Pilih file XLSX atau CSV.']);
    const fallback=String(form.get('portfolio')||'');
    if(fallback&&!/^(IND|PIK|SERCO|KSP|HMPM|AEBT|LAB|MIN|BBR|LSI)$/.test(fallback))throw new UmaImportError(['Portofolio file tidak valid.']);
    const parsed=await parseUma(file.name,Buffer.from(await file.arrayBuffer()),fallback);
    const db=await masterClient();
    const {data,error}=await db.rpc('sync_equipment_uma',{
      b:c.branch,filename:file.name.replace(/[^\p{L}\p{N} ._()-]/gu,'_').slice(0,180),filehash:parsed.hash,items:parsed.rows,
    });
    if(error)return NextResponse.json({error:'Impor dibatalkan seluruhnya; belum ada perubahan yang disimpan.',issues:error.code==='P0001'?error.message.split('\n'):['57014','55P03'].includes(error.code)?['Impor melewati batas waktu atau masih ada impor lain yang berjalan. Coba kembali atau bagi file per portofolio.']:['Periksa kewenangan portofolio, sesi/MFA, serta format data.']},{status:422,headers});
    for(const path of ['/kalibrasi-alat','/dashboard','/master-data/alat'])revalidatePath(path);
    revalidatePath('/kalibrasi-alat/[id]','page');revalidatePath('/peristiwa-kalibrasi/[id]','page');
    return NextResponse.json({...data,ignored:parsed.ignored},{headers});
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
