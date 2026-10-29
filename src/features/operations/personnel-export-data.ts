import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { DataRow } from "@/features/master-data/server";

export async function personnelExportData(
  db: SupabaseClient<Database>,
  rows: DataRow[],
  branch: string,
) {
  const employeeIds = [...new Set(rows.map((r) => String(r.employee_id)))];
  const portfolioIds = [
    ...new Set(
      rows.flatMap((r) =>
        Array.isArray(r.portfolio_ids) ? r.portfolio_ids.map(String) : [],
      ),
    ),
  ];
  // Bound URL lengths and keep every lookup under the same signed-in user's RLS.
  async function employees() {
    const result = new Map<
      string,
      {
        full_name: string;
        npp: string | null;
        position: string | null;
        employment_category: string | null;
      }
    >();
    for (let offset = 0; offset < employeeIds.length; offset += 200) {
      const { data, error } = await db
        .from("employee_directory")
        .select("id,full_name,npp,position,employment_category")
        .eq("branch_code", branch)
        .in("id", employeeIds.slice(offset, offset + 200))
        .limit(200);
      if (error)
        throw Error("Identitas pegawai untuk ekspor belum dapat dimuat.");
      for (const r of data || []) result.set(r.id, r);
    }
    return result;
  }
  async function portfolios() {
    const result = new Map<string, string>();
    for (let offset = 0; offset < portfolioIds.length; offset += 200) {
      const { data, error } = await db
        .from("portfolios")
        .select("id,code")
        .eq("branch_code", branch)
        .in("id", portfolioIds.slice(offset, offset + 200))
        .limit(200);
      if (error) throw Error("Portofolio untuk ekspor belum dapat dimuat.");
      for (const r of data || []) result.set(r.id, r.code);
    }
    return result;
  }
  const [people, plots, branchResult] = await Promise.all([
    employees(),
    portfolios(),
    db.from("branches").select("name").eq("code", branch).single(),
  ]);
  if (branchResult.error)
    throw Error("Nama cabang untuk ekspor belum dapat dimuat.");
  return {
    branchName: branchResult.data.name,
    rows: rows.map((r) => {
      const employee = people.get(String(r.employee_id));
      if (!employee)
        throw Error(
          "Identitas pegawai untuk ekspor tidak tersedia dalam cakupan akun.",
        );
      const codes = (Array.isArray(r.portfolio_ids) ? r.portfolio_ids : [])
        .map((id) => plots.get(String(id)))
        .filter((v): v is string => !!v);
      return {
        ...r,
        employee_name: employee.full_name,
        npp: employee.npp,
        position: employee.position,
        employment_category: employee.employment_category,
        portfolio_plot: [...new Set(codes)]
          .sort((a, b) => a.localeCompare(b, "id"))
          .join(" / "),
      };
    }),
  };
}
