"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/guards";
import { masterClient } from "@/features/master-data/server";
import type { QcPost, QcThread } from "./model";

const targetSchema = z.object({ branch: z.string().regex(/^[A-Z0-9]{2,8}$/), domain: z.enum(["calibration","personnel"]), record: z.uuid() });
export async function loadQcThreads(input: unknown, page = 0) {
  const target=targetSchema.parse(input);
  await requireActiveUser();
  const db=await masterClient();
  const offset=Math.max(0,Math.min(1000,Math.floor(page)))*20;
  const {data,error,count}=await db.from("certificate_qc_threads")
    .select("id,title,status,version,recipient_names,created_at,updated_at",{count:"exact"})
    .eq("branch_code",target.branch).eq("domain",target.domain).eq("record_id",target.record)
    .order("updated_at",{ascending:false}).order("id").range(offset,offset+19);
  if(error)throw Error("Catatan QC belum dapat dimuat. Silakan muat ulang.");
  return {threads:(data||[]) as QcThread[],total:count||0};
}
export async function loadQcPosts(thread: string, page=0) {
  await requireActiveUser();
  if(!z.uuid().safeParse(thread).success)throw Error("Temuan tidak valid.");
  const db=await masterClient();
  const offset=Math.max(0,Math.min(1000,Math.floor(page)))*30;
  const {data,error,count}=await db.from("certificate_qc_posts")
    .select("id,author_name,operation,body,resulting_status,document_id,created_at",{count:"exact"})
    .eq("thread_id",thread).order("created_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+29);
  if(error)throw Error("Percakapan belum dapat dimuat. Coba kembali.");
  return {posts:((data||[]) as QcPost[]).reverse(),total:count||0};
}
export async function loadQcThread(input:unknown,id:string){
  const target=targetSchema.parse(input);z.uuid().parse(id);await requireActiveUser();
  const db=await masterClient();
  const {data,error}=await db.from("certificate_qc_threads").select("id,title,status,version,recipient_names,created_at,updated_at")
    .eq("id",id).eq("branch_code",target.branch).eq("domain",target.domain).eq("record_id",target.record).maybeSingle();
  if(error)throw Error("Temuan belum dapat dibuka.");
  return data as QcThread|null;
}
export async function submitQc(input: unknown) {
  const parsed=targetSchema.extend({
    thread:z.uuid().nullable(),operation:z.enum(["open","reply","request_review","close","reopen"]),
    body:z.string().trim().max(4000),title:z.string().trim().max(160),
    version:z.number().int().nonnegative(),requestId:z.uuid(),evidence:z.uuid().nullable(),
  }).safeParse(input);
  if(!parsed.success)return {error:"Periksa judul dan isi catatan."};
  await requireActiveUser();
  const p=parsed.data,db=await masterClient();
  const {data,error}=await db.rpc("submit_certificate_qc",{
    b:p.branch,d:p.domain,r:p.record,t:p.thread,op:p.operation,message:p.body,heading:p.title,
    expected_version:p.version,request_id:p.requestId,evidence:p.evidence,
  });
  if(error)return {error:error.code==="40001"?"Ada balasan terbaru. Muat ulang sebelum melanjutkan.":error.code==="42501"?"Akses tindakan ini tidak tersedia untuk akun Anda.":"Catatan belum tersimpan. Periksa isian atau muat ulang sebelum mencoba lagi."};
  revalidatePath("/notifikasi");
  revalidatePath("/peristiwa-kalibrasi/"+p.record);
  revalidatePath("/kompetensi-personil/"+p.record);
  revalidatePath("/kalibrasi-alat");
  return {id:String(data)};
}
