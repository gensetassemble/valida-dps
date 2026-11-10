"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/guards";
import { masterClient } from "@/features/master-data/server";

const idsSchema = z.array(z.uuid()).min(1).max(25);
export async function archiveNotifications(ids: string[], archived: boolean) {
  const { user } = await requireActiveUser();
  if (!idsSchema.safeParse(ids).success || typeof archived !== "boolean") return {error: "Pilihan arsip tidak valid."};
  const db = await masterClient();
  const {data, error: readError} = await db.from("user_notifications").select("id").eq("profile_id", user.id).is("archived_at", null).in("id", [...new Set(ids)]);
  if (readError || data?.length !== new Set(ids).size) return {error: "Notifikasi tidak tersedia untuk akun Anda."};
  const now = new Date().toISOString();
  const {error} = await db.from("notification_archive_preferences").upsert(data.map(n => ({notification_id:n.id,profile_id:user.id,archived_at:archived ? now : null,updated_at:now})), {onConflict:"notification_id"});
  if (error) return {error: "Arsip belum tersimpan. Silakan coba kembali."};
  revalidatePath("/", "layout");
  return {count:data.length};
}
export async function readNotifications(ids: string[] | null) {
  const { user } = await requireActiveUser();
  if (ids !== null && !idsSchema.safeParse(ids).success)
    return { error: "Pilihan notifikasi tidak valid." };
  const db = await masterClient();
  let visible = db.from("notification_user_feed").select("id").eq("profile_id", user.id).is("user_archived_at", null).is("read_at", null).limit(10000);
  if (ids !== null) visible = visible.in("id", [...new Set(ids)]);
  const {data: inbox, error: inboxError} = await visible;
  if (inboxError) return {error: "Inbox belum dapat dimuat."};
  if (!inbox?.length) return {count:0};
  let query = db
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() }, { count: "exact" })
    .eq("profile_id", user.id)
    .is("archived_at", null)
    .is("read_at", null);
  query = query.in("id", inbox.map(n => n.id));
  if (ids !== null) query = query.in("id", [...new Set(ids)]);
  const { count, error } = await query;
  if (error)
    return { error: "Status baca belum tersimpan. Silakan coba kembali." };
  revalidatePath("/", "layout");
  return { count: count || 0 };
}
