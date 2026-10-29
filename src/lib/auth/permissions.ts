export const ROLE_LABELS = {
  super_admin: "Super Admin (IT Officer)",
  admin: "Admin",
  tester: "Tester (Baca Saja)",
  account_manager: "Account Manager / Marketing",
  hrga: "HRGA",
  coordinator: "Koordinator Operasional",
  qshe: "QSHE",
  equipment_manager: "PTK / PJ Peralatan Kalibrasi",
  inspector: "Personil / Inspector",
  branch_head: "Kepala Cabang",
  department_head: "Kepala Bidang",
  unit_head: "Kepala UP",
} as const;
export type Role = keyof typeof ROLE_LABELS;
export type Scope = { branch_code: string; role_code: Role };
export const ALL_ROLES = Object.keys(ROLE_LABELS) as Role[];
// Match the database capability mapping. All grants remain branch-specific.
const INHERITED_ROLE: Partial<Record<Role, Role>> = {
  super_admin: "admin",
  tester: "branch_head",
  department_head: "branch_head",
  unit_head: "branch_head",
};
export function isRole(value: string): value is Role {
  return Object.hasOwn(ROLE_LABELS, value);
}
export function activeBranch(
  scopes: Scope[],
  home: string,
  requested?: string,
) {
  if (requested) return requested;
  return scopes.some((scope) => scope.branch_code === home)
    ? home
    : scopes[0]?.branch_code || home;
}
export function hasPermission(
  scopes: Scope[],
  branch: string,
  allowed: readonly Role[],
) {
  return scopes.some(
    (scope) =>
      scope.branch_code === branch &&
      (allowed.includes(scope.role_code) ||
        !!(INHERITED_ROLE[scope.role_code] &&
          allowed.includes(INHERITED_ROLE[scope.role_code]!))),
  );
}
