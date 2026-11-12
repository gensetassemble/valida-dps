import {describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {simulationScopes} from "@/lib/simulation";
import {getEntity} from "@/features/master-data/registry";
import {saveSimulationProfile} from "@/features/master-data/simulation-profile";
import type {SupabaseClient} from "@supabase/supabase-js";
describe("Primary-site simulation isolation",()=>{
 it("never mixes operational reader privileges and simulation admin privileges",()=>{
  const scopes=[{branch_code:"DPS",role_code:"tester"},{branch_code:"SIMDPS",role_code:"super_admin"}];
  expect(simulationScopes(scopes,false)).toEqual([scopes[0]]);
  expect(simulationScopes(scopes,true)).toEqual([scopes[1]]);
 });
 it("uses separate identity and permission tables only for the reserved workspace",()=>{
  expect(getEntity("pengguna","DPS")?.table).toBe("profiles");
  expect(getEntity("pengguna","SIMDPS")?.table).toBe("simulation_profiles");
  expect(getEntity("penugasan-peran","SIMDPS")?.table).toBe("simulation_role_assignments");
 });
 it("never sends or stores passwords or calls Auth Admin when saving a simulated identity",async()=>{
  const query={insert:vi.fn(),select:vi.fn(),single:vi.fn()};
  query.insert.mockReturnValue(query);query.select.mockReturnValue(query);query.single.mockResolvedValue({data:{id:"simulated"},error:null});
  const from=vi.fn().mockReturnValue(query);
  const db={from} as unknown as SupabaseClient;
  expect(await saveSimulationProfile(db,"DPS",undefined,{full_name:"No"})).toHaveProperty("error");
  expect(from).not.toHaveBeenCalled();
  await saveSimulationProfile(db,"SIMDPS",undefined,{full_name:"Training",password:"Never-store-this"});
  expect(from).toHaveBeenCalledWith("simulation_profiles");
  expect(query.insert).toHaveBeenCalledWith({full_name:"Training",branch_code:"SIMDPS"});
 });
});
