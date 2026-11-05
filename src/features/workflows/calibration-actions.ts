"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/guards";
import { masterClient } from "@/features/master-data/server";
import { normalizeCalibrationLaboratory } from "@/features/operations/calibration-laboratories";
const inputSchema = z
  .object({
    equipment_id: z.uuid(),
    equipment_ids: z.array(z.uuid()).min(1).max(50),
    request_kind: z.enum(["repair", "calibration"]),
    request_number: z
      .string()
      .trim()
      .regex(/^\d{1,4}$/),
    signature_place: z.string().trim().min(1).max(100),
    certificate_name: z.string().trim().min(1).max(250),
    certificate_address: z.string().trim().max(1000),
    item_details: z.record(
      z.uuid(),
      z
        .object({
          resolution_class: z.string().max(200),
          instrument_reading: z.string().max(12000),
        })
        .strict(),
    ),
    laboratory: z.string().trim().max(200).transform(normalizeCalibrationLaboratory),
    resolution_class: z.string().trim().max(200),
    supervisor_profile_id: z.uuid(),
    notes: z.string().trim().min(8).max(4000),
  })
  .strict();
function refresh() {
  revalidatePath("/", "layout");
  revalidatePath("/kalibrasi-alat", "layout");
  revalidatePath("/master-data/alat");
  revalidatePath("/notifikasi");
}
export async function submitEquipmentRequest(branch: string, input: unknown) {
  const c = await requireActiveUser();
  const parsed = inputSchema.safeParse(input);
  if (
    !/^[A-Z0-9]{2,8}$/.test(branch) ||
    !c.scopes.some(
      (s) => s.branch_code === branch && s.role_code === "coordinator",
    )
  )
    return { error: "Pengajuan hanya untuk Koordinator Operasional." };
  if (!parsed.success)
    return { error: "Lengkapi formulir dan keterangan minimal 8 karakter." };
  const db = await masterClient();
  const { data, error } = await db
    .from("calibration_requests")
    .insert({ ...parsed.data, branch_code: branch, status: "submitted" })
    .select("id")
    .single();
  if (error)
    return {
      error:
        error.code === "23505"
          ? "Masih ada pengajuan aktif untuk alat ini."
          : error.code === "P0001"
            ? error.message
            : "Pengajuan ditolak. Periksa portofolio dan akses akun.",
    };
  refresh();
  return { id: String(data.id) };
}

export async function equipmentRequestOptions(branch: string) {
  const c = await requireActiveUser();
  if (
    !c.scopes.some(
      (s) => s.branch_code === branch && s.role_code === "coordinator",
    )
  )
    return { error: "Pengajuan hanya untuk Koordinator Operasional." };
  const db = await masterClient();
  const [equipment, portfolios, requests, heads] = await Promise.all([
    db
      .from("equipment")
      .select("id,name,tag,portfolio_id,location")
      .eq("branch_code", branch)
      .eq("ownership", "internal")
      .eq("is_active", true)
      .order("name")
      .limit(1000),
    db
      .from("portfolios")
      .select("id,code")
      .eq("branch_code", branch)
      .eq("is_active", true)
      .limit(100),
    db
      .from("calibration_requests")
      .select("equipment_id,equipment_ids")
      .eq("branch_code", branch)
      .not("status", "in", "(completed,cancelled)")
      .limit(1000),
    db.rpc("calibration_request_supervisors", { b: branch }),
  ]);
  if (
    equipment.error ||
    portfolios.error ||
    requests.error ||
    heads.error ||
    equipment.data.length === 1000 ||
    requests.data.length === 1000
  )
    return {
      error: "Pilihan alat belum dapat dimuat seluruhnya. Silakan coba lagi.",
    };
  const busy = new Set<string>(
    requests.data.flatMap((r) => r.equipment_ids || [r.equipment_id]),
  );
  const codes = new Map<string, string>(
    portfolios.data.map((p) => [p.id, p.code]),
  );
  return {
    tools: equipment.data
      .filter((e) => codes.has(e.portfolio_id))
      .map((e) => ({
        ...e,
        code: codes.get(e.portfolio_id)!,
        unavailable: busy.has(e.id),
      })),
    supervisors: (heads.data || []).map(
      (h: { id: string; full_name: string }) => ({
        id: h.id,
        label: h.full_name,
      }),
    ),
  };
}
export async function updateEquipmentRequestProgress(
  branch: string,
  id: string,
  version: number,
  status: "accepted" | "completed",
) {
  const c = await requireActiveUser();
  if (
    !z.uuid().safeParse(id).success ||
    !Number.isInteger(version) ||
    !["accepted", "completed"].includes(status) ||
    !c.scopes.some(
      (s) => s.branch_code === branch && s.role_code === "equipment_manager",
    )
  )
    return { error: "Progres hanya untuk PTK." };
  const db = await masterClient();
  const { data, error } = await db
    .from("calibration_requests")
    .update({ status })
    .eq("id", id)
    .eq("branch_code", branch)
    .eq("version", version)
    .select("id")
    .maybeSingle();
  if (error || !data)
    return {
      error: "Progres belum tersimpan. Muat ulang dan periksa cakupan akses.",
    };
  refresh();
  return { ok: true };
}

export async function manageEquipmentRequest(
  branch: string,
  id: string,
  version: number,
  operation: "cancel" | "delete_history",
) {
  const c = await requireActiveUser();
  const allowed =
    operation === "delete_history"
      ? ["super_admin"]
      : ["super_admin", "admin", "coordinator", "equipment_manager"];
  if (
    !/^[A-Z0-9]{2,8}$/.test(branch) ||
    !z.uuid().safeParse(id).success ||
    !Number.isInteger(version) ||
    version < 1 ||
    !["cancel", "delete_history"].includes(operation) ||
    !c.scopes.some(
      (s) => s.branch_code === branch && allowed.includes(s.role_code),
    )
  )
    return { error: "Anda tidak berwenang melakukan tindakan ini." };
  const db = await masterClient();
  // The database checks the record's actual branch, creator, state and version.
  const { error } = await db.rpc("manage_equipment_request", {
    r: id,
    expected_version: version,
    operation,
  });
  if (error)
    return {
      error:
        "Tindakan belum tersimpan. Muat ulang dan periksa hak akses atau status pengajuan.",
    };
  refresh();
  return { ok: true };
}
