import { redirect } from "next/navigation";
import { AuthForm } from "@/components/shared/auth-form";
import { getSupabaseConfig } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";
export default async function UpdatePage() {
  if (!getSupabaseConfig()) redirect("/login");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login?status=callback-error");
  return <><h1 className="text-2xl font-bold">Perbarui kata sandi</h1><p className="mt-2 text-sm text-muted-foreground">Gunakan minimal 12 karakter.</p><AuthForm mode="update" configured/></>;
}
