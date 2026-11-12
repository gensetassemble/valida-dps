"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { entityContext, masterClient } from "@/features/master-data/server";
import type { MutationResult } from "@/features/master-data/actions";

const schema = z.object({
  id: z.uuid(),
  branch: z.string().regex(/^[A-Z0-9]{2,8}$/),
  updatedAt: z.iso.datetime({ offset: true }),
  confirmed: z.literal(true),
}).strict();

export async function deleteArchivedEquipment(input: unknown): Promise<MutationResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Periksa konfirmasi dan muat ulang data alat." };
  const { id, branch, updatedAt } = parsed.data;
  const context = await entityContext("kalibrasi-alat", branch, true);
  if (!context.scopes.some(s => s.branch_code === branch && ["super_admin", "equipment_manager", "coordinator"].includes(s.role_code)))
    return { ok: false, error: "Hapus permanen hanya untuk Super Admin, PTK, atau Koordinator portofolio terkait." };
  const db = await masterClient();
  const { data, error } = await db.from("equipment").delete()
    .eq("id", id).eq("branch_code", branch).eq("is_active", false)
    .eq("updated_at", updatedAt).select("id");
  if (error) return { ok: false, error: error.code === "P0001" ? error.message.slice(0,350) : "Penghapusan ditolak. Pastikan alat diarsipkan, tidak memiliki riwayat, dan sesi MFA masih aktif." };
  if (!data?.length) return { ok: false, error: "Data alat sudah berubah atau akses ditolak. Refresh sebelum mencoba kembali." };
  revalidatePath("/kalibrasi-alat", "layout");
  revalidatePath("/master-data/alat", "layout");
  revalidatePath("/dashboard");
  return { ok: true, message: "Alat arsip dihapus permanen. Jejak audit tetap tersimpan." };
}
