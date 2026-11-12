import "server-only";
import { cache } from "react";
import { masterClient } from "@/features/master-data/server";

// React.cache is request-scoped: never reuse RLS-protected results across users.
export const equipmentOptions = cache(async (branch: string) => {
  const db = await masterClient();
  const { data, error } = await db.from("equipment_monitoring_records")
    .select("portfolio_id,portfolio_code,owner_unit,is_active")
    .eq("branch_code", branch).limit(10000);
  const portfolios = new Map<string, { id: string; code: string; count: number }>();
  const filters = new Map<string, { id: string; code: string }>();
  const units = new Set<string>();
  for (const row of data || []) {
    units.add(row.owner_unit || "__unset__");
    if (!row.portfolio_id || !row.portfolio_code) continue;
    const id = String(row.portfolio_id), code = String(row.portfolio_code);
    filters.set(id, { id, code });
    if (row.is_active) {
      const item = portfolios.get(id) || { id, code, count: 0 };
      item.count++;
      portfolios.set(id, item);
    }
  }
  return {
    unavailable: !!error,
    portfolios: [...portfolios.values()].sort((a,b) => a.code.localeCompare(b.code)),
    filters: [...filters.values()].sort((a,b) => a.code.localeCompare(b.code)),
    units: [...units].sort((a,b) => a.localeCompare(b,"id")),
  };
});
