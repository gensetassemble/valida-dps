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
export async function recordRenewalFollowup(input: unknown) {
  const p = z
    .object({
      certificate: z.uuid(),
      branch: z.string().regex(/^[A-Z0-9]{2,8}$/),
      target: z
        .enum([
          "contacted",
          "offered",
          "po_received",
          "deferred",
          "not_renewed",
        ])
        .nullable(),
      note: z.string().trim().min(8).max(2000),
      document: z.uuid().nullable(),
      details: z
        .object({
          pic_name: z.string().trim().min(2).max(200),
          channel: z.enum(["email", "phone", "whatsapp", "meeting"]),
          contact_id: z.uuid().optional(),
          recipient_email: z.email().max(254).optional(),
          subject: z.string().trim().max(200).optional(),
          confirmed: z.boolean().optional(),
          document_number: z.string().trim().min(2).max(200).optional(),
          document_date: z.iso.date().optional(),
          follow_up_date: z.iso.date().optional(),
          reason: z.string().trim().min(8).max(2000).optional(),
        })
        .strict(),
    })
    .strict()
    .safeParse(input);
  if (!p.success)
    return {
      error: "Periksa PIC, saluran, catatan, tanggal dan bukti dokumen.",
    };
  await entityContext("sertifikat-klien", p.data.branch, true);
  const db = await masterClient();
  const { error } = await db.rpc("record_renewal_followup", {
    cert: p.data.certificate,
    target: p.data.target,
    note: p.data.note,
    details: p.data.details,
    doc: p.data.document,
  });
  if (error)
    return {
      error:
        "Catatan ditolak. Pastikan PIC utama sudah diperiksa, kegiatan sudah dilakukan, urutan tahap benar, serta nomor, tanggal dan PDF sesuai gate.",
    };
  revalidatePath("/pipeline-perpanjangan");
  return { ok: true };
}

export async function getRenewalHistory(certificate: string, branch: string) {
  if (!z.uuid().safeParse(certificate).success)
    return { error: "Sertifikat tidak valid.", rows: [] };
  const c = await entityContext("sertifikat-klien", branch);
  const db = await masterClient();
  const { data: certificateRow, error: accessError } = await db
    .from("client_certificates")
    .select("id")
    .eq("id", certificate)
    .eq("branch_code", c.branch)
    .maybeSingle();
  if (accessError || !certificateRow)
    return { error: "Sertifikat tidak dapat diakses.", rows: [] };
  const [{ data: logs, error }, { data: opportunity }] = await Promise.all([
    db
      .from("renewal_communications")
      .select(
        "id,created_at,note,kind,stage,pic_name,channel,recipient_email,subject,details,document_id",
      )
      .eq("certificate_id", certificate)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("renewal_opportunities")
      .select("id")
      .eq("certificate_id", certificate)
      .maybeSingle(),
  ]);
  if (error) return { error: "Riwayat belum dapat dimuat.", rows: [] };
  const { data: events, error: eventsError } = opportunity
    ? await db
        .from("renewal_events")
        .select("id,created_at,note,to_stage")
        .eq("opportunity_id", opportunity.id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [], error: null };
  if (eventsError)
    return { error: "Riwayat status belum dapat dimuat.", rows: [] };
  const rows = [
    ...(logs || []),
    ...(events || [])
      .filter(
        (e) =>
          !(logs || []).some(
            (l) =>
              l.kind === "status" &&
              l.stage === e.to_stage &&
              l.note === e.note &&
              l.created_at === e.created_at,
          ),
      )
      .map((e) => ({ ...e, kind: "status", stage: e.to_stage })),
  ];
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { rows };
}
