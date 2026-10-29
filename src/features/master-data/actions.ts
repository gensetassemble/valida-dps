"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission } from "@/lib/auth/permissions";
import { entityContext, masterClient, publicDatabaseError } from "./server";
import { recordSchema, requestScopeSchema } from "./validation";
import { addMonths } from "@/lib/domain/validity";
import { measurementKeys } from "@/features/operations/monitoring";
export type MutationResult =
  | { ok: true; message: string; id?: string }
  | { ok: false; error: string; fields?: Record<string, string> };
export async function saveRecord(
  request: unknown,
  input: unknown,
): Promise<MutationResult> {
  const scope = requestScopeSchema.safeParse(request);
  if (!scope.success)
    return { ok: false, error: "Lingkup permintaan tidak valid." };
  const context = await entityContext(
    scope.data.entity,
    scope.data.branch,
    true,
  );
  const { entity, branch, user, scopes } = context;
  if (!scope.data.id && entity.create === false)
    return {
      ok: false,
      error: "Penambahan data ini memerlukan provisioning organisasi.",
    };
  const parsed = recordSchema(entity, !!scope.data.id).safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Periksa kembali data formulir.",
      fields: Object.fromEntries(
        parsed.error.issues.map((issue) => [
          String(issue.path[0] || "form"),
          issue.message,
        ]),
      ),
    };
  const payload: Record<string, unknown> = { ...parsed.data };
  if (entity.key === "kalibrasi-alat") {
    payload.ownership = "internal";
    payload.client_id = null;
  }
  if (entity.key === "riwayat-kalibrasi") {
    const base =
      payload[
        payload.calculation_base === "issue_date"
          ? "issue_date"
          : "calibration_date"
      ];
    if (
      typeof base === "string" &&
      typeof payload.interval_months === "number"
    ) {
      payload.calculated_due_date = addMonths(base, payload.interval_months);
      if (!payload.due_date) payload.due_date = payload.calculated_due_date;
      if (
        payload.verification_status === "verified" &&
        payload.reported_due_date &&
        payload.reported_due_date !== payload.calculated_due_date &&
        String(payload.resolution_note || "").trim().length < 8
      )
        return {
          ok: false,
          error:
            "Tanggal dokumen berbeda dengan perhitungan. Jelaskan penyelesaian konflik sebelum verifikasi.",
        };
    } else payload.calculated_due_date = null;
  }
  if (entity.key === "kompetensi-personil")
    payload.source_provider = payload.source_folder_url
      ? "google_drive_folder"
      : null;
  if (
    ["sertifikat-klien", "kompetensi-personil"].includes(entity.key) &&
    payload.validity_kind !== "lifetime" &&
    !payload.expiry_date &&
    typeof payload.issue_date === "string" &&
    typeof payload.interval_months === "number"
  )
    payload.expiry_date = addMonths(
      payload.issue_date,
      payload.interval_months,
    );
  const isAdmin = hasPermission(scopes, branch, ["admin"]);
  if (entity.key === "pelanggan" && !isAdmin) {
    if (!scope.data.id) payload.account_manager_id = user.id;
    else {
      delete payload.account_manager_id;
      delete payload.portfolio_id;
    }
  }
  if (entity.key !== "cabang" && entity.key !== "roles")
    payload.branch_code = branch;
  const db = await masterClient();
  if (entity.key === "riwayat-kalibrasi" && scope.data.id) {
    const { data: current, error } = await db
      .from("calibrations")
      .select("monitoring_measurements")
      .eq("id", scope.data.id)
      .eq("branch_code", branch)
      .maybeSingle();
    if (error || !current)
      return { ok: false, error: "Peristiwa kalibrasi tidak dapat diakses." };
    if (
      Array.isArray(current.monitoring_measurements) &&
      current.monitoring_measurements.length > 1
    ) {
      payload.monitoring_measurements = current.monitoring_measurements.map(
        (value, index) =>
          index === 0 &&
          value &&
          typeof value === "object" &&
          !Array.isArray(value)
            ? {
                ...value,
                ...Object.fromEntries(
                  measurementKeys
                    .filter((key) => key in payload)
                    .map((key) => [key, payload[key]]),
                ),
              }
            : value,
      );
    }
  }
  if (entity.key === "kalibrasi-alat" && !scope.data.id) {
    const calibration: Record<string, unknown> = {};
    const enabled = payload.initial_enabled;
    for (const key of Object.keys(payload)) {
      if (key.startsWith("initial_")) {
        if (key !== "initial_enabled") calibration[key.slice(8)] = payload[key];
        delete payload[key];
      }
    }
    delete payload.branch_code;
    if (
      enabled &&
      !calibration.due_date &&
      typeof calibration.calibration_date === "string" &&
      typeof calibration.interval_months === "number"
    )
      calibration.due_date = addMonths(
        calibration.calibration_date,
        calibration.interval_months,
      );
    const { data, error } = await db.rpc("create_equipment_with_calibration", {
      b: branch,
      asset: payload,
      calibration: enabled ? calibration : null,
    });
    if (error) return { ok: false, error: publicDatabaseError(error.code) };
    revalidatePath(entity.path, "layout");
    revalidatePath("/dashboard");
    return {
      ok: true,
      id: String(data),
      message: enabled
        ? "Alat dan kalibrasi awal tersimpan."
        : "Alat tersimpan.",
    };
  }
  const query = scope.data.id
    ? db
        .from(entity.table)
        .update(payload)
        .eq(entity.idKey, scope.data.id)
        .eq(entity.key === "cabang" ? "code" : "branch_code", branch)
    : db.from(entity.table).insert(payload);
  const { data, error } = await query.select(entity.idKey).maybeSingle();
  if (error) return { ok: false, error: publicDatabaseError(error.code) };
  if (!data)
    return {
      ok: false,
      error:
        "Tidak ada data yang tersimpan. Rekaman tidak ditemukan atau akses telah berubah.",
    };
  revalidatePath(entity.path, "layout");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: "Perubahan telah tersimpan.",
    id: String((data as unknown as Record<string, unknown>)[entity.idKey]),
  };
}
export async function setRecordsActive(
  request: unknown,
  ids: unknown,
  active: unknown,
  reason?: unknown,
): Promise<MutationResult> {
  const scope = requestScopeSchema.safeParse(request);
  const selected = z
    .array(z.string().min(1).max(100))
    .min(1)
    .max(20)
    .refine((ids) => new Set(ids).size === ids.length)
    .safeParse(ids);
  if (!scope.success || !selected.success || typeof active !== "boolean")
    return { ok: false, error: "Pilihan perubahan tidak valid." };
  const { entity, branch, user } = await entityContext(
    scope.data.entity,
    scope.data.branch,
    true,
  );
  if (!entity.fields.some((field) => field.key === "is_active"))
    return { ok: false, error: "Perubahan status tidak tersedia." };
  if (entity.key === "pengguna" && selected.data.includes(user.id))
    return { ok: false, error: "Status akun sendiri tidak dapat diubah." };
  const payload: Record<string, unknown> = { is_active: active };
  if (entity.key === "penugasan-peran") {
    const parsed = z.string().trim().min(8).max(1000).safeParse(reason);
    if (!parsed.success)
      return {
        ok: false,
        error: "Tuliskan alasan pemberian/pencabutan minimal 8 karakter.",
      };
    payload.grant_reason = parsed.data;
  }
  const db = await masterClient();
  const { data, error } = await db
    .from(entity.table)
    .update(payload)
    .in(entity.idKey, selected.data)
    .eq(entity.key === "cabang" ? "code" : "branch_code", branch)
    .select(entity.idKey);
  if (error) return { ok: false, error: publicDatabaseError(error.code) };
  if (data?.length !== selected.data.length)
    return {
      ok: false,
      error:
        "Sebagian pilihan tidak dapat diakses. Muat ulang data untuk memeriksa status aktual.",
    };
  revalidatePath(entity.path, "layout");
  return {
    ok: true,
    message: `Status ${data.length} rekaman telah diperbarui.`,
  };
}
