"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/env/public";
import { getAppConfig } from "@/lib/env/server";
import { loginSchema, resetSchema, passwordSchema } from "@/lib/auth/schemas";
export async function login(input: unknown) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: "Periksa alamat email dan kata sandi." };
  if (!getSupabaseConfig()) return { error: "Layanan autentikasi belum dikonfigurasi." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Email atau kata sandi tidak sesuai, atau akun belum dapat digunakan." };
  redirect("/dashboard");
}
export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("Sesi belum dapat diakhiri. Silakan coba kembali.");
  redirect("/login");
}
export async function resetPassword(input: unknown) {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { error: "Alamat email tidak valid." };
  if (!getSupabaseConfig()) return { error: "Layanan autentikasi belum dikonfigurasi." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: new URL("/auth/callback", getAppConfig().APP_URL).toString() });
  if (error) return { error: "Permintaan belum dapat diproses. Silakan coba kembali nanti." };
  return { message: "Jika akun memenuhi syarat, petunjuk pemulihan akan dikirim ke alamat tersebut." };
}
export async function updatePassword(input: unknown) {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return { error: "Gunakan kata sandi minimal 12 karakter." };
  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) return { error: "Tautan pemulihan tidak valid atau telah kedaluwarsa." };
  const { error } = await supabase.auth.updateUser(parsed.data);
  if (error) return { error: "Kata sandi belum dapat diperbarui." };
  await supabase.auth.signOut();
  redirect("/login?status=password-updated");
}
