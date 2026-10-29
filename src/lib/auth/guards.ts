import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/env/public";
import { cache } from "react";
import { isRole, type Scope } from "./permissions";
export const requireActiveUser = cache(async () => {
  if (!getSupabaseConfig()) redirect("/login?status=unconfigured");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  const [
    { data: profile, error: profileError },
    { data: grants, error: grantError },
    { data: branches },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, employee_id, branch_code, is_active, full_name, email, whatsapp",
      )
      .eq("id", data.user.id)
      .single(),
    supabase
      .from("user_role_assignments")
      .select(
        "role_code, branch_code, roles!inner(is_active), branches!inner(is_active)",
      )
      .eq("profile_id", data.user.id)
      .eq("is_active", true)
      .is("revoked_at", null)
      .eq("roles.is_active", true)
      .eq("branches.is_active", true),
    supabase.from("branches").select("code,name").order("code"),
  ]);
  if (profileError || !profile?.is_active) redirect("/login?status=inactive");
  if (grantError) throw new Error("Penugasan akses belum dapat diperiksa.");
  const scopes: Scope[] = (grants ?? []).flatMap((grant) =>
    isRole(grant.role_code)
      ? [{ role_code: grant.role_code, branch_code: grant.branch_code }]
      : [],
  );
  return { user: data.user, profile, scopes, branches: branches ?? [] };
});
