"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { entityContext, masterClient } from "@/features/master-data/server";
import { hasPermission } from "@/lib/auth/permissions";
import { loadEmailTemplate } from "./email-server";
import { renewalEmailProviderStatus } from "./email-provider-status";
import { validateEmailTemplate,renderRenewalEmail } from "./renewal-email";
import { RENEWAL_EMAIL_DEMO_CONTACT } from "./email-demo";
import {recordRenewalFollowup} from "./actions";
const scope = z.object({certificate:z.uuid(),branch:z.string().regex(/^[A-Z0-9]{2,8}$/)}).strict();
export async function getRenewalEmailPreview(input:unknown) {
  const p=scope.safeParse(input);
  if(!p.success) return {error:"Sertifikat tidak valid."};
  const c=await entityContext("sertifikat-klien",p.data.branch,true);
  const db=await masterClient();
  const {data:cert,error}=await db.from("client_certificate_display_records")
    .select("id,client_id,client_name,certificate_number,certificate_type_name,object_type,object_serial,installation_location,expiry_date,account_manager_name,is_example,is_active")
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
  const demoMode=!provider.enabled;
  return {data:{
    context:{customer:cert.client_name || "",number:cert.certificate_number || "",certificateType:cert.certificate_type_name || "",
      object:cert.object_type || "",serial:cert.object_serial || "",location:cert.installation_location || "",expiryDate:cert.expiry_date || "",pic:"",serviceName:cert.certificate_type_name || ""},
    contacts:contacts || [],clientId:cert.client_id,accountManager:cert.account_manager_name || "Belum ditugaskan",template,stage:String(opportunity?.stage || "uncontacted"),
    isAdmin:hasPermission(c.scopes,c.branch,["admin"]),provider,demoMode,demoContact:RENEWAL_EMAIL_DEMO_CONTACT,
    testRecipients:demoMode ? [RENEWAL_EMAIL_DEMO_CONTACT.email] : hasPermission(c.scopes,c.branch,["admin"]) ? (process.env.VALIDA_EMAIL_TEST_RECIPIENTS || "").split(",").map(v=>v.trim().toLowerCase()).filter(v=>z.email().safeParse(v).success && v.endsWith("@sucofindo.co.id")) : [],
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
// No live sender exists yet. Even a manipulated request cannot supply recipients,
// provider tokens, success statuses or renewal transitions to this action.
export async function requestRenewalEmailSend(input:unknown) {
  const p=z.object({certificate:z.uuid(),branch:z.string().regex(/^[A-Z0-9]{2,8}$/),mode:z.enum(["test","official"])}).strict().safeParse(input);
  if(!p.success) return {error:"Permintaan pengiriman tidak valid."};
  const preview=await getRenewalEmailPreview({certificate:p.data.certificate,branch:p.data.branch});
  if(!preview.data) return {error:preview.error || "Sertifikat tidak dapat diakses."};
  if(p.data.mode === "test" && !preview.data.isAdmin) return {error:"Pengiriman uji hanya untuk Admin."};
  return {error:preview.data.provider.reason,code:"INTEGRATION_DISABLED" as const};
}
export type EmailPreviewData = NonNullable<Awaited<ReturnType<typeof getRenewalEmailPreview>>["data"]>;
