import type { Role, Scope } from "@/lib/auth/permissions";
import { hasPermission } from "@/lib/auth/permissions";
import type { ImportDomain } from "./normalize";

export const IMPORT_ROLES_BY_DOMAIN: Record<
  ImportDomain,
  readonly Role[]
> = {
  employees: ["admin"],
  personnel: ["hrga"],
  clients: ["account_manager"],
  calibrations: ["equipment_manager"],
};

export const IMPORT_NAVIGATION_ROLES = [
  "admin",
  "hrga",
  "account_manager",
  "equipment_manager",
] as const satisfies readonly Role[];

export function importDomainsForScopes(scopes: Scope[], branch: string) {
  return (Object.keys(IMPORT_ROLES_BY_DOMAIN) as ImportDomain[]).filter(
    (domain) =>
      hasPermission(scopes, branch, IMPORT_ROLES_BY_DOMAIN[domain]),
  );
}

export function canImportDomain(
  scopes: Scope[],
  branch: string,
  domain: ImportDomain,
) {
  return hasPermission(scopes, branch, IMPORT_ROLES_BY_DOMAIN[domain]);
}
