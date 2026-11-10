import { beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({guard:vi.fn(),client:vi.fn(),revalidate:vi.fn(),insert:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("next/cache",()=>({revalidatePath:m.revalidate}));
vi.mock("@/lib/auth/guards",()=>({requireActiveUser:m.guard}));
vi.mock("@/features/master-data/server",()=>({masterClient:m.client}));
import {saveWorkflow} from "@/features/workflows/actions";
const certificate="af600000-0000-4000-8000-000000000001";
describe("HRGA renewal start",()=>{
 beforeEach(()=>{vi.resetAllMocks();m.guard.mockResolvedValue({scopes:[{branch_code:"DPS",role_code:"hrga"}]});m.insert.mockReturnValue({select:()=>({maybeSingle:async()=>({data:{id:"new-case",status:"processing",version:1},error:null})})});m.client.mockResolvedValue({from:()=>({insert:m.insert})});});
 it("creates one processing record with the operator note and refreshes monitoring",async()=>{const result=await saveWorkflow("personnel","DPS",null,null,{certificate_id:certificate,status:"processing",notes:"Sudah diajukan ke penerbit"});expect(result.record?.status).toBe("processing");expect(m.insert).toHaveBeenCalledTimes(1);expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({status:"processing",notes:"Sudah diajukan ke penerbit"}));expect(m.revalidate).toHaveBeenCalledWith("/notifikasi");});
 it.each(["unprocessed","renewed"])("rejects a new %s case before a database mutation",async status=>{const result=await saveWorkflow("personnel","DPS",null,null,{certificate_id:certificate,status,notes:"Catatan pengajuan baru"});expect(result.error).toMatch(/Sedang Diproses/);expect(m.client).not.toHaveBeenCalled();});
 it("keeps notes and HRGA authorization mandatory",async()=>{expect((await saveWorkflow("personnel","DPS",null,null,{certificate_id:certificate,status:"processing",notes:""})).error).toBeTruthy();m.guard.mockResolvedValue({scopes:[{branch_code:"DPS",role_code:"tester"}]});expect((await saveWorkflow("personnel","DPS",null,null,{certificate_id:certificate,status:"processing",notes:"Catatan pengajuan baru"})).error).toBeTruthy();expect(m.insert).not.toHaveBeenCalled();});
});
