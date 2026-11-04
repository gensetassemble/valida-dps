import "server-only";
import { masterClient } from "@/features/master-data/server";
import { DEFAULT_EMAIL_TEMPLATE, validateEmailTemplate, type EmailTemplate } from "./renewal-email";
export async function loadEmailTemplate(branch:string):Promise<EmailTemplate> {
  const db = await masterClient();
  const {data,error} = await db.from("client_renewal_email_templates").select("subject,body,version").eq("branch_code",branch).order("version",{ascending:false}).limit(1).maybeSingle();
  if (error) throw Error("Template email belum dapat dimuat. Periksa migrasi dan akses template.");
  if (!data) return DEFAULT_EMAIL_TEMPLATE;
  if (validateEmailTemplate(data.subject,data.body)) throw Error("Template tersimpan tidak valid. Minta Admin memulihkan template standar.");
  return data;
}
