import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Existing snapshots win. Legacy drafts look up their original creator, never the viewer. */
export async function resolveRequestIdentity(
  db: SupabaseClient,
  request: Record<string, unknown>,
) {
  let resolved = { ...request };
  if (!resolved.requester_employee_id) {
    const { data, error } = await db
      .rpc("calibration_request_form_identity", { r: request.id })
      .single();
    if (error || !data) throw Error("Identitas pengaju belum dapat dimuat.");
    resolved = {
      ...resolved,
      ...(data as {
        requester_employee_id: string | null;
        requester_npp: string | null;
      }),
    };
  }
  const equipment = (resolved.equipment_snapshot || {}) as Record<
    string,
    unknown
  >;
  if (
    !resolved.portfolio_code_snapshot &&
    typeof equipment.portfolio_id === "string"
  ) {
    const { data, error } = await db
      .from("portfolios")
      .select("code")
      .eq("id", equipment.portfolio_id)
      .eq("branch_code", resolved.branch_code)
      .maybeSingle();
    if (error) throw Error("Portofolio pengajuan belum dapat dimuat.");
    if (data) resolved.portfolio_code_snapshot = data.code;
  }
  return resolved;
}
