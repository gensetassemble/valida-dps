"use server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireActiveUser } from "@/lib/auth/guards";
import { hasSecondFactor } from "@/lib/auth/security";
import { masterClient } from "@/features/master-data/server";
import { getAuthAdminClient } from "@/lib/supabase/auth-admin";
import { todayWita } from "@/lib/domain/validity";
import { bulkRowSchema, MAX_BULK_USERS, reviewBulkRows, type BulkReviewRow, type Employee } from "./model";
import {SIMULATION_BRANCH} from "@/lib/simulation";
import {saveSimulationProfile} from "@/features/master-data/simulation-profile";

async function context(branch:string) {
 const c=await requireActiveUser();const db=await masterClient();
 if(!/^[A-Z0-9]{2,8}$/.test(branch)||!c.scopes.some(s=>s.branch_code===branch&&s.role_code==="super_admin")||!(await hasSecondFactor(db)))throw Error("Hanya Super Admin cabang dengan MFA yang dapat membuat akun massal.");
 return {...c,db};
}
function configuration(){const key=process.env.BULK_USER_REVIEW_SECRET,password=process.env.BULK_USER_INITIAL_PASSWORD;if(!key||key.length<48||!password||password.length<12)throw Error("Pembuatan akun massal belum dikonfigurasi pada server.");return {key,password};}
function signature(body:string){return createHmac("sha256",configuration().key).update(body).digest("base64url");}
type Review={actor:string;branch:string;expires:number;rows:BulkReviewRow[]};
function readReview(token:string):Review {
 if(token.length>150000)throw Error("Pratinjau tidak valid.");const [body,mac,...extra]=token.split(".");if(!body||!mac||extra.length)throw Error("Pratinjau tidak valid.");
 const expected=Buffer.from(signature(body)),actual=Buffer.from(mac);if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw Error("Pratinjau telah berubah. Ulangi pemeriksaan file.");
 const r=JSON.parse(Buffer.from(body,"base64url").toString("utf8")) as Review;if(!r.expires||r.expires<Date.now()||!Array.isArray(r.rows)||r.rows.length>MAX_BULK_USERS)throw Error("Pratinjau expired. Periksa ulang file sebelum melanjutkan.");return r;
}
export async function previewBulkUsers(branch:string,input:unknown) {
 try {
  const c=await context(branch);configuration();if(branch!==SIMULATION_BRANCH&&!getAuthAdminClient())return {error:"Layanan pembuatan akun belum dikonfigurasi."};
  if(!Array.isArray(input)||!input.length||input.length>MAX_BULK_USERS||JSON.stringify(input).length>100000)return {error:"Unggah 1–100 baris sesuai template."};
  const [people,profiles,coordinators]=await Promise.all([
   c.db.from("employee_directory_records").select("id,full_name,npp,employment_status,is_active,updated_at").eq("branch_code",branch).limit(5001),
   c.db.from(branch===SIMULATION_BRANCH?"simulation_profiles":"profiles").select("email,employee_id").eq("branch_code",branch).limit(5001),
   c.db.from("portfolio_coordinators").select("employee_id,effective_until").eq("branch_code",branch).eq("is_active",true).lte("effective_from",todayWita()).limit(1000),
  ]);
  if(people.error||profiles.error||coordinators.error||people.data.length>5000||profiles.data.length>5000)return {error:"Direktori atau akun belum dapat diperiksa. Hubungi IT."};
  const eligible=new Set(coordinators.data.filter(r=>!r.effective_until||r.effective_until>=todayWita()).map(r=>String(r.employee_id)));
  const rows=reviewBulkRows(input,people.data as Employee[],profiles.data,eligible);
  const review:Review={actor:c.user.id,branch,expires:Date.now()+15*60*1000,rows};const body=Buffer.from(JSON.stringify(review)).toString("base64url");
  return {rows,token:body+"."+signature(body),expiresAt:new Date(review.expires).toISOString()};
 }catch(error){unstable_rethrow(error);return {error:error instanceof Error?error.message:"Pratinjau belum dapat dibuat."};}
}
async function cleanupNewLogin(admin:SupabaseClient,id:string) {
 try {
  // A transport failure may happen after the DB transaction committed. Never
  // delete Auth while a committed profile exists or its absence is uncertain.
  const {data,error}=await admin.from("profiles").select("id").eq("id",id).maybeSingle();
  if(error||data)return false;
  return !(await admin.auth.admin.deleteUser(id)).error;
 }catch{return false;}
}
export async function createBulkUser(token:string,index:number) {
 let created:string|undefined;
 try {
  const review=readReview(token);const c=await context(review.branch);
  if(c.user.id!==review.actor||!Number.isInteger(index)||index<0||index>=review.rows.length)throw Error("Pratinjau tidak sesuai sesi Admin.");
  const r=review.rows[index];if(r.status!=="ready"||!r.employeeId)return {status:"skip" as const,message:"Baris tidak disetujui untuk dibuat."};
  const parsed=bulkRowSchema.safeParse({name:r.name,npp:r.npp,email:r.email,roles:r.roles});if(!parsed.success)throw Error("Isi pratinjau tidak valid.");
  const {data:existing,error:existingError}=await c.db.from(review.branch===SIMULATION_BRANCH?"simulation_profiles":"profiles").select("id").eq("branch_code",review.branch).ilike("email",r.email).limit(1);
  if(existingError)throw Error("Profil belum dapat diperiksa.");if(existing.length)return {status:"skip" as const,message:"Akun sudah ada; tidak diubah."};
  const {data:e,error}=await c.db.from("employee_directory_records").select("id,full_name,npp,employment_status,is_active,updated_at").eq("branch_code",review.branch).eq("id",r.employeeId).maybeSingle();
  if(error||!e||!e.is_active||e.employment_status!=="active"||e.updated_at!==r.version)throw Error("Data pegawai berubah atau tidak aktif. Ulangi pratinjau.");
  if(review.branch===SIMULATION_BRANCH){
    const saved=await saveSimulationProfile(c.db,review.branch,undefined,{employee_id:e.id,full_name:e.full_name,npp:e.npp,email:r.email,whatsapp:null,is_active:true});
    if(saved.error||!saved.id)throw Error(saved.error||"Profil simulasi belum dibuat.");
    const {error}=await c.db.from("simulation_role_assignments").insert(r.roles.map(role_code=>({profile_id:saved.id,branch_code:review.branch,role_code,grant_reason:"Simulasi pembuatan akun massal; tidak memberi login nyata.",is_active:true})));
    if(error)throw Error("Profil simulasi tersimpan; peran simulasi belum berhasil dicatat.");
    return {status:"success" as const,message:"Profil dan peran simulasi dibuat; tidak membuat login, password, atau email sungguhan."};
  }
  const admin=getAuthAdminClient();if(!admin)throw Error("Layanan akun belum dikonfigurasi.");
  const result=await admin.auth.admin.createUser({email:r.email,password:configuration().password,email_confirm:true});
  if(result.error||!result.data.user)return {status:"error" as const,message:"Login belum dibuat. Email mungkin sudah terdaftar atau layanan Auth menolak permintaan; akun lama tidak diubah."};
  created=result.data.user.id;
  const saved=await c.db.rpc("provision_bulk_user",{b:review.branch,details:{employee_id:e.id,full_name:e.full_name,npp:e.npp,email:r.email,whatsapp:null,is_active:false},role_codes:r.roles});
  if(saved.error || String(saved.data)!==created) {
   const cleaned=await cleanupNewLogin(admin,created);created=undefined;
   return {status:"error" as const,message:!cleaned?"Hasil transaksi perlu diperiksa IT sebelum mengulang email ini. Login tidak dihapus karena status profil belum dapat dipastikan.":"Profil/peran ditolak database. Login baru sudah dibersihkan; periksa data dan ulangi pratinjau."};
  }
  created=undefined;
  return {status:"success" as const,message:"Akun dan peran dibuat. Wajib mengganti password awal saat login pertama; tidak ada email dikirim."};
 }catch(error){
  unstable_rethrow(error);
  if(created){const admin=getAuthAdminClient();if(!admin||!(await cleanupNewLogin(admin,created)))return {status:"error" as const,message:"Pembuatan terputus. IT perlu memeriksa login baru sebelum Anda mengulang email ini."};}
  return {status:"error" as const,message:error instanceof Error?error.message:"Pembuatan akun belum berhasil."};
 }
}
