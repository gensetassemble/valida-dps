import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { branchLocation, monitoringOfficials } from "./export-context";

export async function monitoringExportData(
  db: SupabaseClient<Database>,
  branch: string,
) {
  const [people, unit] = await Promise.all([
    db
      .from("employee_directory")
      .select(
        "full_name,position,employment_status,archived_at,merged_into_employee_id",
      )
      .eq("branch_code", branch)
      .eq("employment_status", "active")
      .is("archived_at", null)
      .is("merged_into_employee_id", null)
      .ilike("position", "%kepala%")
      .limit(101),
    db.from("branches").select("name").eq("code", branch).single(),
  ]);
  if (
    people.error ||
    unit.error ||
    !unit.data ||
    (people.data || []).length > 100
  )
    throw Error(
      "Pejabat aktif dan lokasi cabang untuk ekspor belum dapat dimuat.",
    );
  return {
    ...monitoringOfficials(people.data || []),
    location: branchLocation(unit.data.name),
  };
}
