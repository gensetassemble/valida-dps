import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Existing snapshots win. Legacy drafts look up their original creator, never the viewer. */
export async function resolveRequestIdentity(db: SupabaseClient, request: Record<string, unknown>) {
  if (request.requester_employee_id) return request;
  const { data, error } = await db.rpc("calibration_request_form_identity", { r: request.id }).single();
  if (error || !data) throw Error("Identitas pengaju belum dapat dimuat.");
  return { ...request, ...(data as { requester_employee_id: string | null; requester_npp: string | null }) };
}
