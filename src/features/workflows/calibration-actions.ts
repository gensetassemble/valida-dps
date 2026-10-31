"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/guards";
import { masterClient } from "@/features/master-data/server";
const inputSchema = z
  .object({
    equipment_id: z.uuid(),
    request_kind: z.enum(["repair", "calibration"]),
    request_number: z.string().trim().min(2).max(200),
    unit_name: z.string().trim().min(2).max(200),
    quantity: z.coerce.number().int().min(1).max(10000),
    laboratory: z.string().trim().max(200),
    resolution_class: z.string().trim().max(200),
    supervisor_profile_id: z.uuid().nullable(),
    notes: z.string().trim().min(8).max(4000),
  })
  .strict();
function refresh() {
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
