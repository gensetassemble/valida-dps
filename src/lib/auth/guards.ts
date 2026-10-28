import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/env/public";
export async function requireActiveUser() {
  if (!getSupabaseConfig()) redirect("/login?status=unconfigured");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("id, branch_code, role_code, is_active, display_name").eq("id", data.user.id).single();
  if (profileError || !profile?.is_active) redirect("/login?status=inactive");
  return { user: data.user, profile };
}
