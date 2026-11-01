"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { masterClient } from "@/features/master-data/server";

const schema = z
  .object({
    id: z.uuid(),
    branch: z.string().regex(/^[A-Z0-9]{2,8}$/),
    version: z.number().int().positive(),
    operation: z.enum(["cancel", "delete_history"]),
    reason: z.string().trim().min(8).max(2000),
    confirmed: z.literal(true),
  })
  .strict();

export async function manageRenewal(input: unknown) {
  const context = await requireActiveUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { error: "Isi alasan minimal 8 karakter dan konfirmasi tindakan." };
  const p = parsed.data;
  if (!hasPermission(context.scopes, p.branch, ["admin", "hrga"]))
    return {
      error:
        "Pengelolaan proses hanya untuk HRGA/administrator pada cabang ini.",
    };
  const db = await masterClient();
  const { error } = await db.rpc("manage_personnel_renewal", {
    r: p.id,
    b: p.branch,
    expected_version: p.version,
    operation: p.operation,
    reason: p.reason,
  });
  if (error)
    return {
      error:
        error.code === "P0001"
          ? error.message.slice(0, 350)
          : "Perubahan ditolak. Periksa akses dan muat ulang data.",
    };
  revalidatePath("/", "layout");
  return { ok: true };
}
