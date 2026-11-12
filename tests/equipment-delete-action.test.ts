import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(()=>({ context:vi.fn(), client:vi.fn(), revalidate:vi.fn() }));
vi.mock("@/features/master-data/server",()=>({entityContext:mocks.context,masterClient:mocks.client}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
import { deleteArchivedEquipment } from "@/features/operations/equipment-delete-action";
const input={id:"10000000-0000-4000-8000-000000000001",branch:"DPS",updatedAt:"2026-11-12T00:00:00+00:00",confirmed:true};
describe("Permanent deletion of archived equipment",()=>{
  beforeEach(()=>{vi.clearAllMocks();mocks.context.mockResolvedValue({scopes:[{branch_code:"DPS",role_code:"super_admin"}]});});
  it("rejects missing confirmation and forged extra payloads before database access",async()=>{
    expect((await deleteArchivedEquipment({...input,confirmed:false})).ok).toBe(false);
    expect((await deleteArchivedEquipment({...input,role:"super_admin"})).ok).toBe(false);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("rejects coordinators and Super Admins from another branch",async()=>{
    for(const scopes of [[{branch_code:"DPS",role_code:"coordinator"}],[{branch_code:"OTHER",role_code:"super_admin"}]]){
      mocks.context.mockResolvedValue({scopes});
      expect((await deleteArchivedEquipment(input)).ok).toBe(false);
    }
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("limits deletion to the archived row and rejects stale results",async()=>{
    const query={delete:vi.fn(),eq:vi.fn(),select:vi.fn()};
    query.delete.mockReturnValue(query);query.eq.mockReturnValue(query);
    query.select.mockResolvedValue({data:[],error:null});
    const from=vi.fn().mockReturnValue(query);mocks.client.mockResolvedValue({from});
    expect((await deleteArchivedEquipment(input)).ok).toBe(false);
    expect(from).toHaveBeenCalledWith("equipment");
    expect(query.eq.mock.calls).toEqual([["id",input.id],["branch_code","DPS"],["is_active",false],["updated_at",input.updatedAt]]);
    expect(mocks.revalidate).not.toHaveBeenCalled();
    query.select.mockResolvedValue({data:[{id:input.id}],error:null});
    expect((await deleteArchivedEquipment(input)).ok).toBe(true);
    expect(mocks.revalidate).toHaveBeenCalledWith("/kalibrasi-alat","layout");
  });
  it("returns the database's dependency refusal without reporting success",async()=>{
    const query={delete:vi.fn(),eq:vi.fn(),select:vi.fn()};
    query.delete.mockReturnValue(query);query.eq.mockReturnValue(query);
    query.select.mockResolvedValue({data:null,error:{code:"P0001",message:"Alat masih memiliki riwayat kalibrasi."}});
    mocks.client.mockResolvedValue({from:()=>query});
    expect(await deleteArchivedEquipment(input)).toEqual({ok:false,error:"Alat masih memiliki riwayat kalibrasi."});
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
