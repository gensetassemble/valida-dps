import {beforeEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const mocks=vi.hoisted(()=>({getUser:vi.fn(),from:vi.fn(),set:vi.fn(),membership:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({auth:{getUser:mocks.getUser},from:mocks.from})}));
vi.mock("next/headers",()=>({cookies:async()=>({set:mocks.set})}));
import {POST} from "@/app/api/simulation/route";
describe("Simulation mode endpoint",()=>{
 beforeEach(()=>{
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({data:{user:{id:"tester"}},error:null});
  const query={select:vi.fn(),eq:vi.fn()};
  query.select.mockReturnValue(query);
  query.eq.mockImplementation((key:string)=>key==="is_active"?mocks.membership():query);
  mocks.from.mockReturnValue(query);
  mocks.membership.mockResolvedValue({data:[{branch_code:"SIMDPS"}],error:null});
 });
 const request=(enabled:unknown,origin="https://valida.example.invalid")=>new NextRequest("https://valida.example.invalid/api/simulation",{method:"POST",headers:{origin,"Content-Type":"application/json"},body:JSON.stringify({enabled})});
 it("requires same origin and valid input before changing mode",async()=>{
  expect((await POST(request(true,"https://outside.example.invalid"))).status).toBe(403);
  expect((await POST(request("true"))).status).toBe(400);
  expect(mocks.set).not.toHaveBeenCalled();
 });
 it("requires a real authenticated account with active membership",async()=>{
  mocks.getUser.mockResolvedValueOnce({data:{user:null},error:null});
  expect((await POST(request(true))).status).toBe(401);
  mocks.membership.mockResolvedValue({data:[],error:null});
  expect((await POST(request(true))).status).toBe(403);
  expect(mocks.set).not.toHaveBeenCalled();
 });
 it("sets only an httpOnly mode preference and redirects to the training branch",async()=>{
  const response=await POST(request(true));
  expect(await response.json()).toEqual({ok:true,href:"/dashboard?branch=SIMDPS"});
  expect(mocks.from).toHaveBeenCalledWith("simulation_workspaces");
  expect(mocks.set).toHaveBeenCalledWith("valida-simulation","true",expect.objectContaining({httpOnly:true,sameSite:"lax",path:"/"}));
 });
 it("allows an authenticated user to exit even if membership is unavailable",async()=>{
  const response=await POST(request(false));
  expect(response.status).toBe(200);
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.set).toHaveBeenCalledWith("valida-simulation","",expect.objectContaining({maxAge:0}));
 });
});
