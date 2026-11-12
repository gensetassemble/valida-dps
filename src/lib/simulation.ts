// Reserved workspace; it must never be used as the operational DPS branch.
export const SIMULATION_BRANCH = "SIMDPS";
export const SIMULATION_COOKIE = "valida-simulation";
export function simulationScopes<T extends {branch_code:string}>(scopes:T[], enabled:boolean) {
  return scopes.filter(s => enabled ? s.branch_code === SIMULATION_BRANCH : s.branch_code !== SIMULATION_BRANCH);
}
