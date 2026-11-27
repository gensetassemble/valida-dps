"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { importContext } from "./server";
import { isProductionEnvironment } from "@/lib/env/runtime";
import { approvedClientWorkbook } from "./client-workbook-batch";
import {
  DOMAINS,
  FIELDS,
  personnelRenewalIntent,
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
  if (!p.success) return { error: "Periksa catatan dan pilihan untuk baris ini." };
  const c = await importContext(p.data.branch, p.data.domain);
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
    return { error: "Data pemeriksaan tidak dapat diakses." };
  const normalized = Object.fromEntries(
    Object.keys(FIELDS[p.data.domain]).map((k) => [
      k,
      String(form.get(k) || "").trim(),
    ]),
  );
  if (p.data.domain === "personnel")
    normalized.renewal_intent = personnelRenewalIntent(normalized);
  if (p.data.decision === "approve") {
    if (form.get("confirmed") !== "on")
      return {
        error: "Centang konfirmasi setelah memastikan data baris ini sudah sesuai.",
      };
    const errors = validateNormalized(
      p.data.domain as ImportDomain,
      normalized,
    );
    if (errors.length) return { error: errors.join(" ") };
  }
  const reviewArgs = {
    r: p.data.row,
    n: normalized,
    approve: p.data.decision === "approve",
    reason: p.data.reason,
  };
  const { error } = p.data.domain === "personnel"
    ? await c.db.rpc("review_personnel_import", reviewArgs)
    : await c.db.rpc("review_import", reviewArgs);
  if (error)
    return {
      error: "Hasil pemeriksaan belum tersimpan. Periksa kewenangan akun dan status data.",
    };
  revalidatePath("/impor-data/" + p.data.batch);
  return { ok: true };
}
export async function commitBatch(form: FormData) {
  const c = await importContext(String(form.get("branch") || ""));
  const batch = z.uuid().safeParse(form.get("batch"));
  if (!batch.success) return { error: "Riwayat impor tidak valid." };
  const { data: batchRow } = await c.db
    .from("import_batches")
    .select("id,domain,status")
    .eq("id", batch.data)
    .eq("branch_code", c.branch)
    .maybeSingle();
  if (!batchRow) return { error: "Riwayat impor tidak dapat diakses." };
  if (!DOMAINS.includes(batchRow.domain as ImportDomain))
    return { error: "Jenis data impor tidak valid." };
  await importContext(c.branch, batchRow.domain as ImportDomain);
  const clientImport = batchRow.domain === "clients";
  const confirmation = "TERAPKAN PEMBARUAN";
  if (form.get("confirmation") !== confirmation)
    return { error: `Ketik ${confirmation} sebagai konfirmasi.` };
  const personnelImport = batchRow.domain === "personnel";
  if (isProductionEnvironment() && !clientImport && !personnelImport)
    return {
      error:
        "Pembaruan ini tidak tersedia pada lingkungan produksi.",
    };
  const { data, error } = await c.db.rpc(
    clientImport
      ? "commit_client_certificate_import"
      : personnelImport
        ? "commit_personnel_certificate_import"
        : "commit_import",
    {
    batch: batch.data,
    },
  );
  if (error)
    return {
      error:
        "Pembaruan dibatalkan. Periksa kecocokan data, tanggal, dan kemungkinan data ganda. Tidak ada data website yang berubah.",
    };
  revalidatePath("/impor-data/" + batch.data);
  revalidatePath("/dashboard");
  if (clientImport) {
    revalidatePath("/sertifikat-klien");
    revalidatePath("/pipeline-perpanjangan");
  }
  if (personnelImport) {
    revalidatePath("/kompetensi-personil");
    revalidatePath("/notifikasi");
  }
  return {
    ok: true,
    message:
      String(data) +
      (clientImport
        ? " sertifikat berhasil diterapkan. Pemeriksaan dokumen resmi tetap dilakukan melalui proses terpisah."
        : personnelImport
          ? " kompetensi berhasil diperbarui. Catatan perpanjangan yang relevan sudah disinkronkan ke status proses."
        : " baris berhasil diterapkan. Pemeriksaan dokumen resmi tetap dilakukan melalui proses terpisah."),
  };
}

export async function approvePersonnelBatch(form: FormData) {
  const c = await importContext(String(form.get("branch") || ""), "personnel");
  const batch = z.uuid().safeParse(form.get("batch"));
  if (!batch.success || form.get("confirmed") !== "on")
    return { error: "Centang konfirmasi setelah memeriksa ringkasan perubahan." };
  const { data, error } = await c.db.rpc("approve_personnel_import_batch", {
    batch: batch.data,
  });
  if (error)
    return { error: "Baris siap belum dapat disetujui. Periksa data yang perlu diperbaiki." };
  revalidatePath("/impor-data/" + batch.data);
  return { ok: true, message: `${data} baris siap disertakan dalam pembaruan.` };
}

// This action deliberately uses the signed-in commercial user's database client, including
// Active role authorization, review_import validation, reviewed_by, and the atomic commit_import RPC.
// It never supplies JWT claims, service credentials, or direct approval writes.
export async function importAuthorizedClientWorkbook(form: FormData) {
  const c = await importContext(String(form.get("branch") || ""), "clients");
  if (form.get("confirmation") !== "TERAPKAN 19 SERTIFIKAT KLIEN" || form.get("confirmed") !== "on")
    return { error: "Pastikan data sudah diperiksa lalu ketik konfirmasi yang ditampilkan." };
  const id = String(form.get("batch") || "");
  const { data: batch, error: batchError } = await c.db.from("import_batches").select("*").eq("id", id).eq("branch_code", c.branch).maybeSingle();
  if (batchError || !batch || !approvedClientWorkbook(batch))
    return { error: "File ini tidak termasuk sumber operasional yang diperbolehkan." };
  const { data: rows, error } = await c.db.from("import_rows").select("id,normalized_values,review_status,decision").eq("batch_id", id).order("source_row");
  const preparedRows = rows?.map((row) => ({
    ...row,
    normalized_values: {
      ...row.normalized_values,
      change_reason:
        row.normalized_values.change_reason || "new_certificate",
    },
  }));
  if (error || preparedRows?.length !== 19 || preparedRows.some(row => !["pending", "approved", "committed"].includes(row.decision) || row.review_status !== "ready" || validateNormalized("clients", row.normalized_values).length))
    return { error: "Seluruh 19 baris harus lengkap dan siap diterapkan. Periksa kembali hasil pembacaan file." };
  for (const row of preparedRows.filter(row => row.decision === "pending")) {
    const { error: reviewError } = await c.db.rpc("review_import", {
      r: row.id, n: row.normalized_values, approve: true,
      reason: "Tim AM/Marketing/PDOS memeriksa dan menyetujui pemetaan workbook klien, 19 baris, melalui sesi aplikasi; bukan verifikasi PDF.",
    });
    if (reviewError) return { error: "Perubahan belum dapat disimpan. Periksa peran AM/Marketing/PDOS dan kecocokan data." };
  }
  const { data: committed, error: commitError } = await c.db.rpc("commit_client_certificate_import", { batch: id });
  if (commitError) return { error: "Pembaruan dibatalkan. Hasil pemeriksaan tetap tersedia; periksa data yang bertentangan." };
  for (const path of ["/impor-data/" + id, "/sertifikat-klien", "/pipeline-perpanjangan", "/dashboard"]) revalidatePath(path);
  return { ok: true, message: `${committed} sertifikat berhasil diterapkan. Kontak [UJI] tetap menjadi penerima internal; tidak ada email yang dikirim.` };
}
