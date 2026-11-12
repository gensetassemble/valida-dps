import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/env/public";
import { cache } from "react";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SIMULATION_BRANCH, SIMULATION_COOKIE, simulationScopes } from "@/lib/simulation";
import { isRole, type Scope } from "./permissions";
import { hasSecondFactor } from "./security";
import { initialPasswordRequired } from "./initial-password";
export const requireActiveUser = cache(async () => {
  if (!getSupabaseConfig()) redirect("/login?status=unconfigured");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  if (await initialPasswordRequired(supabase)) redirect("/initial-password");
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
  const grantedScopes: Scope[] = (grants ?? []).flatMap((grant) =>
    isRole(grant.role_code)
      ? [{ role_code: grant.role_code, branch_code: grant.branch_code }]
      : [],
  );
  const {data: workspaces,error: workspaceError}=grantedScopes.some(s=>s.branch_code===SIMULATION_BRANCH)
    ? await (supabase as SupabaseClient).from("simulation_workspaces").select("branch_code").eq("profile_id",data.user.id).eq("is_active",true)
    : {data:[],error:null};
  if(workspaceError)throw Error("Ruang simulasi belum dapat diperiksa.");
  const canSimulate=(workspaces||[]).some(w=>w.branch_code===SIMULATION_BRANCH);
  const isSimulation=canSimulate && (await cookies()).get(SIMULATION_COOKIE)?.value === "true";
  const scopes=simulationScopes(grantedScopes,isSimulation);
  if (!scopes.length) redirect("/login?status=unassigned");
  if (scopes.some(s => ["admin", "super_admin"].includes(s.role_code)) && !(await hasSecondFactor(supabase)))
    redirect("/mfa");
  return { user: data.user, profile:isSimulation?{...profile,branch_code:SIMULATION_BRANCH}:profile, scopes, branches:(branches ?? []).filter(b=>scopes.some(s=>s.branch_code===b.code)), isSimulation,canSimulate };
});
