import { z } from "zod";
import { ALL_ROLES, ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { personnelText } from "@/lib/personnel-text";
export const MAX_BULK_USERS = 100;
export const bulkRowSchema = z.object({name:z.string().trim().max(160),npp:z.string().trim().max(40),email:z.email().max(254).transform(v=>v.toLowerCase()),roles:z.array(z.enum(ALL_ROLES)).min(1).max(5)}).strict();
export type BulkInput = z.infer<typeof bulkRowSchema>;
export type Employee = {id:string;full_name:string;npp:string|null;employment_status:string;is_active:boolean;updated_at:string};
export type BulkReviewRow = {row:number;name:string;npp:string;email:string;roles:Role[];employeeId?:string;version?:string;status:"ready"|"skip"|"error";message:string};
export function roleCodes(value:string): Role[] {
 const aliases:Record<string,Role>={"super admin":"super_admin","it officer":"super_admin","am":"account_manager","marketing":"account_manager","ptk":"equipment_manager","koordinator operasional":"coordinator","personil":"inspector"};
 return [...new Set(value.split(/[|;]/).map(x=>x.trim()).filter(Boolean).map(x=>{
  const key=x.toLowerCase();const role=ALL_ROLES.find(code=>code===key||ROLE_LABELS[code].toLowerCase()===key)||aliases[key];
  if(!role)throw Error("Peran tidak dikenali: "+x);return role;
 }))];
}
const identity=(value:string)=>personnelText(value).normalize("NFKC").toLowerCase();
export function reviewBulkRows(inputs:unknown[],employees:Employee[],profiles:{email:string;employee_id:string|null}[],coordinatorEmployees:Set<string>) {
 const emailCounts=new Map<string,number>();for(const raw of inputs){const parsed=bulkRowSchema.safeParse(raw);if(parsed.success)emailCounts.set(parsed.data.email,(emailCounts.get(parsed.data.email)||0)+1);}
 const rows:BulkReviewRow[]=inputs.map((raw,i)=>{
  const parsed=bulkRowSchema.safeParse(raw);
  if(!parsed.success)return {row:i+2,name:"",npp:"",email:"",roles:[],status:"error",message:"Nama/NPP, email atau peran tidak valid. Periksa format template."};
  const v=parsed.data;const base={row:i+2,...v,name:personnelText(v.name)};
  const error=(message:string):BulkReviewRow=>({...base,status:"error",message});
  if(emailCounts.get(v.email)!==1)return error("Email berulang dalam file.");
  const matches=employees.filter(e=>v.npp ? e.npp===v.npp : identity(e.full_name)===identity(v.name));
  if(matches.length!==1)return error(matches.length ? "Identitas ambigu; cocokkan NPP atau kelola direktori dahulu." : "Pegawai tidak ditemukan di direktori cabang.");
  const e=matches[0];if(v.name&&identity(e.full_name)!==identity(v.name))return error("Nama dan NPP tidak cocok dengan direktori.");
  const resolved={...base,name:personnelText(e.full_name),npp:e.npp||"",employeeId:e.id,version:e.updated_at};
  if(profiles.some(p=>p.email?.toLowerCase()===v.email))return {...resolved,status:"skip",message:"Email sudah memiliki profil; akun dan peran lama tidak diubah."};
  if(profiles.some(p=>p.employee_id===e.id))return error("Pegawai sudah terhubung ke akun lain. Kelola profil yang ada.");
  if(!e.is_active||e.employment_status!=="active")return error("Pegawai belum aktif; periksa status di Direktori Pegawai.");
  if(v.roles.includes("coordinator")&&!coordinatorEmployees.has(e.id))return error("Koordinator belum memiliki penugasan portofolio aktif. Lengkapi master data dahulu.");
  return {...resolved,status:"ready",message:v.roles.some(r=>["super_admin","admin"].includes(r))?"Siap — akun berwenang tinggi; MFA tetap wajib.":"Siap dibuat; wajib mengganti password saat login pertama."};
 });
 const counts=new Map<string,number>();for(const r of rows)if(r.employeeId&&r.status==="ready")counts.set(r.employeeId,(counts.get(r.employeeId)||0)+1);
 return rows.map(r=>r.employeeId&&(counts.get(r.employeeId)||0)>1?{...r,status:"error" as const,message:"Pegawai berulang dalam file; gunakan satu akun per pegawai."}:r);
}
