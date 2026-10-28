export const ROLE_LABELS = {
  admin: "Admin",
  account_manager: "Account Manager / Marketing",
  hrga: "HRGA",
  coordinator: "Koordinator Operasional",
  qshe: "QSHE",
  equipment_manager: "PJ Peralatan",
  inspector: "Personil / Inspector",
  branch_head: "Kepala Cabang",
} as const;
export type Role = keyof typeof ROLE_LABELS;
export type Scope = { branch_code: string; role_code: Role };
export const ALL_ROLES = Object.keys(ROLE_LABELS) as Role[];
export function isRole(value: string): value is Role {
  return value in ROLE_LABELS;
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
      scope.branch_code === branch && allowed.includes(scope.role_code),
  );
}
