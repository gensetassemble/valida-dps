"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/guards";
import { masterClient } from "@/features/master-data/server";
import { hasPermission } from "@/lib/auth/permissions";
const optionalText = (max = 200) =>
  z.string().trim().max(max).nullable().optional();
const optionalId = z.uuid().nullable().optional();
const calibration = z
  .object({
    equipment_id: z.uuid(),
    status: z.enum([
      "draft",
      "awaiting_signatures",
      "submitted",
      "correction",
      "accepted",
      "completed",
      "cancelled",
    ]),
    request_number: optionalText(),
    unit_name: optionalText(),
    quantity: z.coerce.number().int().min(1).max(10000),
    laboratory: optionalText(),
    resolution_class: optionalText(),
    estimated_days: z.coerce
      .number()
      .int()
      .min(0)
      .max(10000)
      .nullable()
      .optional(),
    estimated_cost: z.coerce.number().min(0).max(1e15).nullable().optional(),
    requester_name: optionalText(),
    supervisor_name: optionalText(),
    requester_signed: z.boolean(),
    supervisor_signed: z.boolean(),
    signed_document_id: optionalId,
    calibration_id: optionalId,
    notes: z.string().trim().min(8).max(4000),
  })
  .strict();
const renewal = z
  .object({
    certificate_id: z.uuid(),
    status: z.enum(["unprocessed", "processing", "renewed"]),
    replacement_certificate_id: optionalId,
    notes: z.string().trim().min(8).max(4000),
  })
  .strict();
export async function saveWorkflow(
  kind: "calibration" | "personnel",
  branch: string,
  id: string | null,
  version: number | null,
  input: unknown,
) {
  const context = await requireActiveUser();
  if (
    !/^[A-Z0-9]{2,8}$/.test(branch) ||
    !hasPermission(
      context.scopes,
      branch,
      kind === "personnel"
        ? ["admin", "hrga"]
        : ["admin", "coordinator", "equipment_manager"],
    )
  )
    return { error: "Anda tidak berwenang memperbarui proses ini." };
  const parsed = (kind === "personnel" ? renewal : calibration).safeParse(
    input,
  );
  if (
    !parsed.success ||
    (id && (!z.uuid().safeParse(id).success || !Number.isInteger(version)))
  )
    return { error: "Periksa formulir dan catatan (minimal 8 karakter)." };
  const db = await masterClient(),
    table =
      kind === "personnel" ? "personnel_renewal_cases" : "calibration_requests";
  const payload: Record<string, unknown> = {
    ...parsed.data,
    branch_code: branch,
  };
  let query;
  if (id) {
    // PTK can only transition status, add notes and link a result. The database
    // independently enforces the same rule against direct REST mutations.
    let patch: Record<string, unknown> = payload;
    if (kind === "calibration") {
      const { data: current } = await db
        .from(table)
        .select("status")
        .eq("id", id)
        .eq("branch_code", branch)
        .maybeSingle();
      if (current && ["submitted", "accepted"].includes(current.status))
        patch = {
          status: payload.status,
          notes: payload.notes,
          calibration_id: (parsed.data as z.infer<typeof calibration>)
            .calibration_id,
        };
    }
    query = db
      .from(table)
      .update(patch)
      .eq("id", id)
      .eq("branch_code", branch)
      .eq("version", version!);
  } else query = db.from(table).insert(payload);
  const { data, error } = await query.select("*").maybeSingle();
  if (error)
    return {
      error:
        error.code === "23505"
          ? "Masih ada permintaan/proses untuk rekaman ini. Buka proses yang sudah tersedia."
          : error.code === "P0001"
            ? error.message.slice(0, 350)
            : error.code === "42501"
              ? "Anda tidak berwenang melakukan perubahan ini."
              : "Perubahan ditolak. Periksa kelengkapan formulir dan gerbang proses.",
    };
  if (!data)
    return {
      error:
        "Data telah berubah atau akses ditolak. Muat ulang sebelum mencoba lagi.",
    };
  revalidatePath(
    kind === "personnel" ? "/kompetensi-personil" : "/kalibrasi-alat",
    "layout",
  );
  revalidatePath("/notifikasi");
  revalidatePath("/dashboard");
  return { record: data as Record<string, unknown> };
}
export async function markNotificationRead(id: string) {
  const { user } = await requireActiveUser();
  if (!z.uuid().safeParse(id).success) return;
  const db = await masterClient();
  await db
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("profile_id", user.id)
    .is("read_at", null);
  revalidatePath("/notifikasi");
}
