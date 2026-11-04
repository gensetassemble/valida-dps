"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { importContext } from "./server";
import { isProductionEnvironment } from "@/lib/env/runtime";
import { approvedClientWorkbook } from "./client-workbook-batch";
import {
  DOMAINS,
  FIELDS,
  validateNormalized,
  type ImportDomain,
} from "./normalize";
export async function reviewRow(form: FormData) {
  const p = z
    .object({
      row: z.uuid(),
      domain: z.enum(DOMAINS),
      batch: z.uuid(),
      branch: z.string().regex(/^[A-Z0-9]{2,8}$/),
      reason: z.string().trim().min(8).max(1000),
      decision: z.enum(["approve", "reject"]),
    })
    .safeParse(
      Object.fromEntries(
        ["row", "domain", "batch", "branch", "reason", "decision"].map((k) => [
          k,
          form.get(k),
        ]),
      ),
    );
  if (!p.success) return { error: "Periksa alasan dan keputusan review." };
  const c = await importContext(p.data.branch);
  const { data: batch } = await c.db
    .from("import_batches")
    .select("id,domain")
    .eq("id", p.data.batch)
    .eq("branch_code", c.branch)
    .maybeSingle();
  const { data: row } = await c.db
    .from("import_rows")
    .select("id")
    .eq("id", p.data.row)
    .eq("batch_id", p.data.batch)
    .maybeSingle();
  if (!batch || batch.domain !== p.data.domain || !row)
    return { error: "Baris/batch tidak dapat diakses." };
  const normalized = Object.fromEntries(
    Object.keys(FIELDS[p.data.domain]).map((k) => [
      k,
      String(form.get(k) || "").trim(),
    ]),
  );
  if (p.data.decision === "approve") {
    if (form.get("confirmed") !== "on")
      return {
        error: "Konfirmasikan pemeriksaan baris dan pemetaan terlebih dahulu.",
      };
    const errors = validateNormalized(
      p.data.domain as ImportDomain,
      normalized,
    );
    if (errors.length) return { error: errors.join(" ") };
  }
  const { error } = await c.db.rpc("review_import", {
    r: p.data.row,
    n: normalized,
    approve: p.data.decision === "approve",
    reason: p.data.reason,
  });
  if (error)
    return {
      error: "Review belum tersimpan; periksa kewenangan dan status baris.",
    };
  revalidatePath("/impor-data/" + p.data.batch);
  return { ok: true };
}
export async function commitBatch(form: FormData) {
  const c = await importContext(String(form.get("branch") || ""));
  const batch = z.uuid().safeParse(form.get("batch"));
  if (!batch.success || form.get("confirmation") !== "IMPOR DPS DEVELOPMENT")
    return { error: "Ketik IMPOR DPS DEVELOPMENT sebagai konfirmasi." };
  if (isProductionEnvironment())
    return {
      error:
        "Target bukan development yang disetujui. Impor kanonis dihentikan.",
    };
  const { data, error } = await c.db.rpc("commit_import", {
    batch: batch.data,
  });
  if (error)
    return {
      error:
        "Transaksi dibatalkan. Periksa pemetaan, identitas, relasi, tanggal dan kemungkinan duplikat. Seluruh baris tetap tersedia untuk review.",
    };
  revalidatePath("/impor-data/" + batch.data);
  revalidatePath("/dashboard");
  return {
    ok: true,
    message:
      String(data) + " baris tersimpan; verifikasi dokumen tetap terpisah.",
  };
}

// This action deliberately uses the signed-in admin's database client, including
// MFA, review_import validation, reviewed_by, and the atomic commit_import RPC.
// It never supplies JWT claims, service credentials, or direct approval writes.
export async function importAuthorizedClientWorkbook(form: FormData) {
  const c = await importContext(String(form.get("branch") || ""));
  if (form.get("confirmation") !== "IMPOR 19 SERTIFIKAT KLIEN DPS" || form.get("confirmed") !== "on")
    return { error: "Periksa pemetaan dan ketik konfirmasi impor 19 sertifikat." };
  const id = String(form.get("batch") || "");
  const { data: batch, error: batchError } = await c.db.from("import_batches").select("*").eq("id", id).eq("branch_code", c.branch).maybeSingle();
  if (batchError || !batch || !approvedClientWorkbook(batch))
    return { error: "Batch ini tidak termasuk sumber operasional yang disetujui." };
  const { data: rows, error } = await c.db.from("import_rows").select("id,normalized_values,review_status,decision").eq("batch_id", id).order("source_row");
  if (error || rows?.length !== 19 || rows.some(row => !["pending", "approved", "committed"].includes(row.decision) || row.review_status !== "ready" || validateNormalized("clients", row.normalized_values).length))
    return { error: "Seluruh 19 baris harus valid dan siap ditinjau. Periksa staging terlebih dahulu." };
  for (const row of rows.filter(row => row.decision === "pending")) {
    const { error: reviewError } = await c.db.rpc("review_import", {
      r: row.id, n: row.normalized_values, approve: true,
      reason: "Admin memeriksa dan menyetujui pemetaan workbook klien, 19 baris, melalui sesi aplikasi; bukan verifikasi PDF.",
    });
    if (reviewError) return { error: "Persetujuan database ditolak. Sertifikat belum diimpor; periksa sesi admin, MFA, dan pemetaan." };
  }
  const { data: committed, error: commitError } = await c.db.rpc("commit_import", { batch: id });
  if (commitError) return { error: "Impor dibatalkan seluruhnya oleh database. Baris review tetap tersedia; periksa konflik sumber." };
  for (const path of ["/impor-data/" + id, "/sertifikat-klien", "/pipeline-perpanjangan", "/dashboard"]) revalidatePath(path);
  return { ok: true, message: `${committed} sertifikat diimpor. Kontak [UJI] tetap penerima internal; tidak ada email yang dikirim.` };
}
