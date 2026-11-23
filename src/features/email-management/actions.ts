"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { entityContext, masterClient } from "@/features/master-data/server";
import { hasPermission } from "@/lib/auth/permissions";
import { runEmailWorker } from "@/lib/microsoft/email-worker";
const branchSchema = z.string().regex(/^[A-Z0-9]{2,8}$/);
export async function saveReminderSettings(input: unknown) {
  const parsed = z.object({ branch: branchSchema, enabled: z.boolean(), days: z.array(z.number().int().min(-365).max(365)).min(1).max(8) }).strict().safeParse(input);
  if (!parsed.success) return { error: "Isi maksimal delapan ambang hari antara -365 dan 365." };
  const c = await entityContext("sertifikat-klien", parsed.data.branch);
  if (!hasPermission(c.scopes,c.branch,["super_admin"])) return { error: "Pengaturan reminder hanya untuk Super Admin." };
  const db = await masterClient();
  const {error} = await db.rpc("configure_email_reminders", { b:c.branch,active:parsed.data.enabled,thresholds:[...new Set(parsed.data.days)] });
  if(error) return {error:"Pengaturan belum tersimpan. Periksa akses dan migrasi database."};
  revalidatePath("/pengaturan/email");
  return {ok:true};
}
export async function processEmailBatch(input: unknown) {
  const parsed=z.object({branch:branchSchema,confirmed:z.literal(true)}).strict().safeParse(input);
  if(!parsed.success) return {error:"Konfirmasikan pemrosesan antrean terlebih dahulu."};
  const c=await entityContext("sertifikat-klien",parsed.data.branch);
  if(!hasPermission(c.scopes,c.branch,["super_admin"]))return {error:"Pemrosesan antrean hanya untuk Super Admin."};
  try { const result=await runEmailWorker({branch:c.branch});revalidatePath("/pengaturan/email");return result.disabled ? {error:"Mailbox dan pengiriman belum diaktifkan."} : {ok:true,processed:result.processed}; }
  catch {return {error:"Batch belum selesai. Periksa status antrean sebelum mencoba kembali."};}
}
export async function manageEmailDelivery(input:unknown) {
  const p=z.object({branch:branchSchema,job:z.uuid(),operation:z.enum(["cancel","retry"]),reason:z.string().trim().min(8).max(1000)}).strict().safeParse(input);
  if(!p.success)return {error:"Pilih antrean dan isi alasan minimal delapan karakter."};
  const c=await entityContext("sertifikat-klien",p.data.branch);
  if(!hasPermission(c.scopes,c.branch,["super_admin"]))return {error:"Pengelolaan antrean hanya untuk Super Admin."};
  const db=await masterClient();const {error}=await db.rpc("manage_email_delivery",{b:c.branch,job:p.data.job,operation:p.data.operation,reason:p.data.reason});
  if(error)return {error:"Status telah berubah atau tindakan tidak diizinkan. Hasil tidak pasti tidak boleh dikirim ulang otomatis."};
  revalidatePath("/pengaturan/email");return {ok:true};
}
