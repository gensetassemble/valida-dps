"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/guards";
import { masterClient } from "./server";
const schema = z.object({ employee: z.uuid(), branch: z.string().regex(/^[A-Z0-9]{2,8}$/), operation: z.enum(["archive", "restore", "verify"]), reason: z.string().trim().min(8).max(2000), updated_at: z.iso.datetime({ offset: true }), confirmed: z.literal(true) }).strict();
export async function manageEmployeeDirectory(input: unknown) {
  const context = await requireActiveUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Periksa tindakan, keterangan (minimal 8 karakter), dan konfirmasi Anda." };
  const p = parsed.data;
  if (!context.scopes.some((s) => s.branch_code === p.branch && s.role_code === "super_admin")) return { error: "Pengelolaan direktori hanya untuk IT Officer pada cabang ini." };
  const db = await masterClient();
  const { error } = await db.rpc("manage_employee_directory", { employee: p.employee, b: p.branch, operation: p.operation, reason: p.reason, expected_updated_at: p.updated_at });
  if (error) return { error: error.code === "P0001" ? error.message.slice(0, 350) : "Perubahan direktori ditolak. Periksa akses cabang." };
  revalidatePath("/master-data/pegawai", "layout");
  revalidatePath("/kompetensi-personil", "layout");
  return { ok: true };
}
