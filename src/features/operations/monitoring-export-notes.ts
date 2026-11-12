import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { DataRow } from "@/features/master-data/server";
import { businessNotes } from "./notes";

/** Equipment remarks and the current calibration remarks both belong in the monitoring report. */
export async function monitoringExportNotes(db: SupabaseClient<Database>, rows: DataRow[], branch: string) {
  const ids = [...new Set(rows.map(row => row.latest_calibration_id).filter((id): id is string => typeof id === "string" && !!id))];
  const notes = new Map<string, string | null>();
  for (let start = 0; start < ids.length; start += 200) {
    const selected = ids.slice(start, start + 200);
    const { data, error } = await db.from("calibrations").select("id,notes").eq("branch_code", branch).in("id", selected).limit(selected.length);
    if (error) throw Error("Keterangan kalibrasi belum dapat dimuat. Silakan coba ekspor kembali.");
    for (const row of data || []) notes.set(row.id, row.notes);
  }
  return rows.map(row => ({ ...row, notes: [...new Set(
    [row.notes, notes.get(String(row.latest_calibration_id))]
      .flatMap(value => businessNotes(value).split(/\s*\|\s*/)).filter(Boolean),
  )].join(" | ") }));
}
