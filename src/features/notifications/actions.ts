"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/guards";
import { masterClient } from "@/features/master-data/server";

const idsSchema = z.array(z.uuid()).min(1).max(25);
export async function readNotifications(ids: string[] | null) {
  const { user } = await requireActiveUser();
  if (ids !== null && !idsSchema.safeParse(ids).success)
    return { error: "Pilihan notifikasi tidak valid." };
  const db = await masterClient();
  let query = db
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() }, { count: "exact" })
    .eq("profile_id", user.id)
    .is("read_at", null);
  if (ids !== null) query = query.in("id", [...new Set(ids)]);
  const { count, error } = await query;
  if (error)
    return { error: "Status baca belum tersimpan. Silakan coba kembali." };
  revalidatePath("/", "layout");
  return { count: count || 0 };
}
