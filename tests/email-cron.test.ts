import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
const worker=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/microsoft/email-worker",()=>({runEmailWorker:worker}));
import {GET} from "@/app/api/cron/email-reminders/route";
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv("CRON_SECRET","synthetic-secret-with-at-least-32-characters");});
afterEach(()=>vi.unstubAllEnvs());
describe("email cron authorization",()=>{
 it("does not invoke the worker without the exact configured bearer secret",async()=>{
  for(const token of [undefined,"Bearer wrong","synthetic-secret-with-at-least-32-characters"]){
   const r=await GET(new NextRequest("https://valida.example/api/cron/email-reminders",{headers:token?{authorization:token}:{}}));expect(r.status).toBe(401);
  }expect(worker).not.toHaveBeenCalled();
 });
 it("fails closed if the cron secret is unset",async()=>{vi.stubEnv("CRON_SECRET","");expect((await GET(new NextRequest("https://valida.example/api/cron/email-reminders"))).status).toBe(401);expect(worker).not.toHaveBeenCalled();});
 it("runs the scheduled worker once and prevents response caching",async()=>{worker.mockResolvedValue({disabled:true,queued:0,processed:0});const r=await GET(new NextRequest("https://valida.example/api/cron/email-reminders",{headers:{authorization:`Bearer ${process.env.CRON_SECRET}`}}));expect(r.status).toBe(200);expect(r.headers.get("cache-control")).toBe("no-store");expect(worker).toHaveBeenCalledWith({schedule:true});});
});
