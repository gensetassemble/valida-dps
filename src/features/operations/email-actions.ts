"use server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { entityContext, masterClient } from "@/features/master-data/server";
import { hasPermission } from "@/lib/auth/permissions";
import { loadEmailTemplate } from "./email-server";
import { renewalEmailProviderStatus } from "./email-provider-status";
import { validateEmailTemplate,renderRenewalEmail } from "./renewal-email";
import { RENEWAL_EMAIL_DEMO_CONTACT } from "./email-demo";
import {recordRenewalFollowup} from "./actions";
import { emailFingerprint } from "./email-fingerprint";
import { runEmailWorker } from "@/lib/microsoft/email-worker";
import { getAuthAdminClient } from "@/lib/supabase/auth-admin";
const scope = z.object({certificate:z.uuid(),branch:z.string().regex(/^[A-Z0-9]{2,8}$/)}).strict();
export async function getRenewalEmailPreview(input:unknown) {
  const p=scope.safeParse(input);
  if(!p.success) return {error:"Sertifikat tidak valid."};
  const c=await entityContext("sertifikat-klien",p.data.branch,true);
  const db=await masterClient();
  const {data:cert,error}=await db.from("client_certificate_display_records")
    .select("id,client_id,client_name,certificate_number,certificate_type_name,object_type,object_serial,installation_location,expiry_date,scope_portfolio_id,account_manager_name,is_example,is_active")
    .eq("id",p.data.certificate).eq("branch_code",c.branch).maybeSingle();
  if(error || !cert || !cert.is_active || cert.is_example) return {error:"Sertifikat aktif tidak ditemukan atau tidak dapat diakses."};
  const [{data:contacts,error:contactError},template,{data:opportunity,error:stageError}]=await Promise.all([
    db.from("client_contacts").select("id,name,position,email,phone,is_test,verification_status,is_primary")
      .eq("client_id",cert.client_id).eq("branch_code",c.branch).eq("is_active",true).order("is_primary",{ascending:false}).order("name").limit(100),
    loadEmailTemplate(c.branch),
    db.from("renewal_opportunities").select("stage").eq("certificate_id",cert.id).eq("branch_code",c.branch).maybeSingle(),
  ]);
  if(contactError) return {error:"Kontak pelanggan belum dapat dimuat."};
  if(stageError) return {error:"Status tindak lanjut belum dapat dimuat."};
  const provider=renewalEmailProviderStatus();
  const demoMode=provider.mode !== "live";
  return {data:{
    context:{customer:cert.client_name || "",number:cert.certificate_number || "",certificateType:cert.certificate_type_name || "",
      object:cert.object_type || "",serial:cert.object_serial || "",location:cert.installation_location || "",expiryDate:cert.expiry_date || "",pic:"",serviceName:cert.certificate_type_name || ""},
    contacts:contacts || [],clientId:cert.client_id,sourceRevision:createHash("md5").update([cert.id,cert.expiry_date,cert.certificate_number,cert.client_id,cert.client_name,cert.certificate_type_name,cert.object_type,cert.object_serial,cert.installation_location,cert.scope_portfolio_id].filter(v=>v!==null && v!==undefined).join("|")).digest("hex"),accountManager:cert.account_manager_name || "Belum ditugaskan",template,stage:String(opportunity?.stage || "uncontacted"),
    isAdmin:hasPermission(c.scopes,c.branch,["admin"]),provider,demoMode,demoContact:RENEWAL_EMAIL_DEMO_CONTACT,
    testRecipients:demoMode || hasPermission(c.scopes,c.branch,["admin"]) ? [RENEWAL_EMAIL_DEMO_CONTACT.email] : [],
  }};
}
export async function recordClientContact(input:unknown):Promise<{ok?:boolean;error?:string}> {
  const p=scope.extend({contact:z.uuid(),channel:z.enum(["email","phone","whatsapp","meeting"]),note:z.string().trim().min(8).max(2000),confirmed:z.literal(true),expectedStage:z.string().max(32),subject:z.string().trim().min(3).max(200).optional()}).strict().safeParse(input);
  if(!p.success) return {error:"Pilih PIC resmi, tulis hasil kontak minimal 8 karakter, dan konfirmasikan komunikasi sudah dilakukan."};
  const preview=await getRenewalEmailPreview({certificate:p.data.certificate,branch:p.data.branch});
  if(!preview.data) return {error:preview.error || "Sertifikat tidak dapat diakses."};
  const d=preview.data,contact=d.contacts.find(c=>c.id === p.data.contact);
  if(!contact || contact.is_test || !contact.is_primary || contact.verification_status !== "verified")
    return {error:"Hasil kontak resmi harus memakai PIC utama terverifikasi. Komunikasi uji tidak memindahkan pipeline."};
  if(d.stage !== p.data.expectedStage) return {error:"Status kartu telah berubah. Muat ulang agar hasil kontak tidak tercatat dua kali."};
  const details:{pic_name:string;channel:typeof p.data.channel;contact_id:string;confirmed:boolean;recipient_email?:string;subject?:string}={pic_name:contact.name,channel:p.data.channel,contact_id:contact.id,confirmed:true};
  if(p.data.channel === "email") {
    if(!z.email().safeParse(contact.email).success) return {error:"Email PIC resmi belum valid. Perbarui kontak pelanggan terlebih dahulu."};
    const subject=p.data.subject || renderRenewalEmail({...d.context,pic:contact.name},d.template,"official").subject;
    if(subject.length>200) return {error:"Sesuaikan subjek email menjadi maksimal 200 karakter pada rincian kontak."};
    details.recipient_email=contact.email!;details.subject=subject;
  }
  const result=await recordRenewalFollowup({certificate:p.data.certificate,branch:p.data.branch,target:["uncontacted","deferred"].includes(d.stage) ? "contacted" : null,note:p.data.note,document:null,details});
  if(result.error) return result;
  revalidatePath("/sertifikat-klien/"+p.data.certificate);
  return {ok:true};
}
export async function saveRenewalEmailTemplate(input:unknown) {
  const p=z.object({branch:z.string().regex(/^[A-Z0-9]{2,8}$/),subject:z.string(),body:z.string(),version:z.number().int().min(0)}).strict().safeParse(input);
  if(!p.success) return {error:"Template tidak valid."};
  const c=await entityContext("sertifikat-klien",p.data.branch);
  if(!hasPermission(c.scopes,c.branch,["admin"])) return {error:"Pengelolaan template hanya untuk Admin."};
  const invalid=validateEmailTemplate(p.data.subject,p.data.body);
  if(invalid) return {error:invalid};
  const db=await masterClient();
  const {data,error}=await db.rpc("save_client_renewal_email_template",{b:c.branch,template_subject:p.data.subject,template_body:p.data.body,expected_version:p.data.version});
  if(error) return {error:error.code === "40001" ? "Template telah berubah. Muat ulang sebelum menyimpan." : "Template belum tersimpan. Periksa akses dan isinya."};
  revalidatePath("/pengaturan/template-email");
  return {version:Number(data)};
}
// Recipients and message content are reloaded from the database; caller supplies
// only the selected PIC and a hash of the preview they explicitly confirmed.
export async function requestRenewalEmailSend(input:unknown) {
  const p=scope.extend({mode:z.enum(["test","official"]),contact:z.uuid().optional(),confirmed:z.boolean().optional(),fingerprint:z.string().regex(/^[a-f0-9]{64}$/).optional()}).strict().safeParse(input);
  if(!p.success) return {error:"Permintaan pengiriman tidak valid."};
  const preview=await getRenewalEmailPreview({certificate:p.data.certificate,branch:p.data.branch});
  if(!preview.data) return {error:preview.error || "Sertifikat tidak dapat diakses."};
  if(p.data.mode === "test" && !preview.data.isAdmin) return {error:"Pengiriman uji hanya untuk Admin."};
  const d=preview.data;
  if(!d.provider.enabled) return {error:d.provider.reason,code:"INTEGRATION_DISABLED" as const};
  if(p.data.mode === "official" && (d.demoMode || process.env.ENABLE_OUTLOOK_COMMERCIAL !== "true")) return {error:"Pengiriman resmi belum diaktifkan. Gunakan mode uji internal."};
  if(!p.data.confirmed || !p.data.fingerprint) return {error:"Periksa pratinjau lalu konfirmasikan pengiriman."};
  const contact=d.contacts.find(v=>v.id===p.data.contact);
  if(p.data.mode === "official" && (!contact || contact.is_test || !contact.is_primary || contact.verification_status !== "verified" || !z.email().safeParse(contact.email).success))
    return {error:"Pilih PIC utama resmi dengan email terverifikasi."};
  const recipient=p.data.mode === "test" ? d.demoContact.email : contact!.email!;
  const email=renderRenewalEmail({...d.context,pic:p.data.mode === "test" ? d.demoContact.name : contact!.name},d.template,p.data.mode);
  if(email.missing.length) return {error:email.missing.join(" · ")};
  const fingerprint=await emailFingerprint({certificate:p.data.certificate,branch:p.data.branch,recipient,subject:email.subject,body:email.body,mode:p.data.mode});
  if(fingerprint!==p.data.fingerprint) return {error:"Data atau template telah berubah. Buka ulang pratinjau sebelum mengirim."};
  const queueClient=getAuthAdminClient();
  if(!queueClient) return {error:"Worker email belum dikonfigurasi. Hubungi IT Officer."};
  const actor=await entityContext("sertifikat-klien",p.data.branch,true);
  const db=await masterClient();
  const {data:job,error}=await queueClient.rpc("enqueue_client_renewal_email",{b:p.data.branch,certificate:p.data.certificate,pic:contact?.id || "00000000-0000-4000-8000-000000000000",delivery_mode:p.data.mode === "test" ? "test" : "live",email_subject:email.subject,email_body:email.body,actor_id:actor.user.id,expected_revision:d.sourceRevision,template_version:d.template.version});
  if(error || !job) return {error:"Email belum masuk antrean. Periksa akses dan data PIC."};
  try { await runEmailWorker({branch:p.data.branch,job}); }
  catch { /* Leave the durable job for reconciliation; never repeat the Graph POST here. */ }
  const {data:status}=await db.from("email_outbox").select("id,state,result_code").eq("id",job).single();
  revalidatePath("/pengaturan/email");
  return {ok:true,job,state:status?.state || "pending",message:status?.state === "accepted" ? "Microsoft 365 menerima email untuk dikirim. Ini belum merupakan konfirmasi email tiba di tujuan." : status?.state === "uncertain" ? "Hasil pengiriman belum pasti. Minta IT Officer memeriksa Sent Items sebelum mencoba lagi." : status?.state === "failed" ? "Pengiriman ditolak. IT Officer dapat memeriksa kode kegagalan pada Riwayat Pengiriman." : "Permintaan tercatat. Lihat status pada Riwayat Pengiriman; jangan mengulangi pengiriman."};
}
export type EmailPreviewData = NonNullable<Awaited<ReturnType<typeof getRenewalEmailPreview>>["data"]>;
