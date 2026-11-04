"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { entityContext, masterClient } from "./server";
const schema = z.object({branch:z.string().regex(/^[A-Z0-9]{2,8}$/),
  field:z.enum(["client_id","certificate_type_id"]),name:z.string().trim().min(2).max(160)}).strict();
export async function createClientReference(input: unknown) {
  const parsed=schema.safeParse(input);
  if (!parsed.success) return {error:"Isi nama (2–160 karakter)."};
  const {branch}=await entityContext("sertifikat-klien",parsed.data.branch,true);
  const db=await masterClient();
  const {data,error}=await db.rpc("create_client_certificate_reference",{
    b:branch, reference_kind:parsed.data.field, reference_name:parsed.data.name,
  });
  if(error || !data?.[0]) return {error:error?.code === "P0001" ? error.message.slice(0,300) : "Pilihan belum tersimpan. Periksa akses dan coba kembali."};
  revalidatePath("/sertifikat-klien");
  revalidatePath(parsed.data.field === "client_id" ? "/pelanggan" : "/master-data/jenis-sertifikat");
  return {option:{value:String(data[0].id),label:String(data[0].name)}};
}
