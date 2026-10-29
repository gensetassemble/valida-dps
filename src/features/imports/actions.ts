"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { importContext } from "./server";
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
  if (
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://invalid.local")
      .hostname !== "vzxmnkmvcbzxrkzdtxuy.supabase.co"
  )
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
