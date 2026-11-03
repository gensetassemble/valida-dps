import "server-only";
import { createClient } from "@/lib/supabase/server";
export async function mfaContext() {
  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw Error("Masuk kembali untuk memverifikasi akun.");
  const profile = await db.from("profiles").select("is_active").eq("id", data.user.id).single();
  if (profile.error || !profile.data?.is_active) throw Error("Akun tidak aktif.");
  return db;
}
