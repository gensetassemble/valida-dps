"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { entityContext, masterClient } from "@/features/master-data/server";
export async function submitCorrection(
  id: string,
  branch: string,
  message: string,
) {
  const c = await entityContext("kompetensi-personil", branch);
  const parsed = z
    .object({ id: z.uuid(), message: z.string().trim().min(8).max(2000) })
    .safeParse({ id, message });
  if (!parsed.success) return { error: "Tuliskan koreksi minimal 8 karakter." };
  const db = await masterClient();
  const { error } = await db.from("personnel_correction_requests").insert({
    certificate_id: id,
    branch_code: c.branch,
    message: parsed.data.message,
    created_by: c.user.id,
  });
  if (error)
    return { error: "Koreksi ditolak atau rekaman tidak dapat diakses." };
  revalidatePath("/kompetensi-personil/" + id);
  return { ok: true };
}
export async function transitionRenewal(input: unknown) {
  const p = z
    .object({
      certificate: z.uuid(),
      branch: z.string().regex(/^[A-Z0-9]{2,8}$/),
      stage: z.enum([
        "contacted",
        "offered",
        "po_received",
        "deferred",
        "not_renewed",
      ]),
      note: z.string().trim().min(8).max(2000),
      document: z.uuid().nullable(),
    })
    .strict()
    .safeParse(input);
  if (!p.success) return { error: "Periksa tahap, catatan dan bukti dokumen." };
  await entityContext("sertifikat-klien", p.data.branch, true);
  const db = await masterClient();
  const { error } = await db.rpc("transition_renewal", {
    cert: p.data.certificate,
    target: p.data.stage,
    note: p.data.note,
    doc: p.data.document,
  });
  if (error)
    return {
      error:
        "Transisi ditolak. Urutan tahap, catatan kontak dan PDF penawaran/PO wajib memenuhi gerbang bisnis.",
    };
  revalidatePath("/pipeline-perpanjangan");
  return { ok: true };
}
