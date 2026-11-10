import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({client:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:mocks.client}));
vi.mock("@/lib/auth/guards",()=>({requireActiveUser:vi.fn()}));
import { listRecords } from "@/features/master-data/server";
import { getEntity } from "@/features/master-data/registry";
describe("equipment portfolio selection reaches the database before pagination",()=>{
 beforeEach(()=>vi.resetAllMocks());
 it("keeps branch and validity constraints and applies IN before range/count",async()=>{
  const events:string[]=[];
  const q={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),in:vi.fn().mockImplementation(()=>{events.push('in');return q;}),order:vi.fn().mockReturnThis(),range:vi.fn().mockImplementation(async()=>{events.push('range');return {data:[],count:0,error:null};})};
  mocks.client.mockResolvedValue({from:()=>q});
  const ids=['cf210000-0000-4000-8000-000000000001','cf210000-0000-4000-8000-000000000002'];
  await listRecords(getEntity('kalibrasi-alat')!,'DPS',{portfolios:ids.join(','),validity:'Expired',page:'2'});
  expect(q.eq).toHaveBeenCalledWith('branch_code','DPS');expect(q.eq).toHaveBeenCalledWith('validity_status','Expired');expect(q.in).toHaveBeenCalledWith('portfolio_id',ids);expect(events).toEqual(['in','range']);expect(q.range).toHaveBeenCalledWith(40,79);
 });
});
