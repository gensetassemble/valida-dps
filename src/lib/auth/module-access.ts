import { hasPermission, type Role, type Scope } from "./permissions";
import type { QueryParams } from "@/features/master-data/server";
export type DashboardDomain = "clients" | "personnel" | "calibrations";
export const MODULE_ACCESS: Record<
  DashboardDomain,
  { read: Role[]; write: Role[]; label: string }
> = {
  clients: {
    read: ["admin", "account_manager", "qshe", "branch_head"],
    write: ["admin", "account_manager"],
    label: "Sertifikat Klien",
  },
  personnel: {
    read: ["admin", "hrga", "coordinator", "qshe", "inspector", "branch_head"],
    write: ["admin", "hrga"],
    label: "Kompetensi Personil",
  },
  calibrations: {
    read: ["admin", "equipment_manager", "coordinator", "qshe", "branch_head"],
    write: ["admin", "equipment_manager"],
    label: "Kalibrasi Alat",
  },
};
export function dashboardScope(
  scopes: Scope[],
  branch: string,
  requested?: string,
) {
  const domains = (Object.keys(MODULE_ACCESS) as DashboardDomain[]).filter(
    (d) => hasPermission(scopes, branch, MODULE_ACCESS[d].read),
  );
  const fallback = domains.length === 1 ? domains[0] : "all";
  const category = domains.includes(requested as DashboardDomain)
    ? requested!
    : fallback;
  return { domains, category };
}
export function dashboardFilters(
  params: QueryParams,
  category: string,
): QueryParams {
  const result = { ...params, category };
  if (category !== "all") {
    if (category !== "clients") {
      delete result.client;
      delete result.am;
      delete result.marketing;
      delete result.area;
    }
    if (category !== "personnel") {
      delete result.employee;
      delete result.kind;
    }
    if (category !== "calibrations") delete result.eligibility;
    // Each domain has a different certificate/type catalogue.
    if (params.category !== category) delete result.type;
    if (category !== "personnel" && result.validity === "Berlaku Seumur Hidup")
      delete result.validity;
  }
  return result;
}
