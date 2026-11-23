import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({context:vi.fn(),from:vi.fn(),rpc:vi.fn(),template:vi.fn(),worker:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/features/master-data/server",()=>({entityContext:mocks.context,masterClient:async()=>({from:mocks.from,rpc:mocks.rpc})}));
vi.mock("@/features/operations/email-server",()=>({loadEmailTemplate:mocks.template}));
vi.mock("@/lib/supabase/auth-admin",()=>({getAuthAdminClient:()=>({rpc:mocks.rpc})}));
vi.mock("@/lib/microsoft/email-worker",()=>({runEmailWorker:mocks.worker}));
import {getRenewalEmailPreview,requestRenewalEmailSend} from "@/features/operations/email-actions";
import {DEFAULT_EMAIL_TEMPLATE,renderRenewalEmail} from "@/features/operations/renewal-email";
import {emailFingerprint} from "@/features/operations/email-fingerprint";
const certificate="ad920000-0000-4000-8000-000000000009",branch="DPS",job="ad920000-0000-4000-8000-000000000099";
beforeEach(()=>{
 vi.resetAllMocks();mocks.context.mockResolvedValue({branch,user:{id:"ad920000-0000-4000-8000-000000000001"},scopes:[{role_code:"super_admin",branch_code:branch}]});mocks.template.mockResolvedValue(DEFAULT_EMAIL_TEMPLATE);mocks.rpc.mockResolvedValue({data:job,error:null});
 for(const [k,v] of Object.entries({ENABLE_OUTLOOK_EMAIL:"true",VALIDA_MAIL_MODE:"test",MICROSOFT_TENANT_ID:"00000000-0000-4000-8000-000000000001",MICROSOFT_CLIENT_ID:"00000000-0000-4000-8000-000000000002",MICROSOFT_CLIENT_SECRET:"synthetic-not-a-real-secret",OUTLOOK_NOTIFICATION_MAILBOX:"valida-uji@sucofindo.co.id",APP_ENVIRONMENT:"development",VERCEL_ENV:""}))vi.stubEnv(k,v);
 mocks.from.mockImplementation((table:string)=>{
  const result=()=>({error:null,data:table==="client_contacts"?[]:table==="renewal_opportunities"?{stage:"uncontacted"}:table==="email_outbox"?{id:job,state:"accepted"}:{id:certificate,client_id:"ad920000-0000-4000-8000-000000000007",client_name:"PT Uji",certificate_number:"QA-CERT",certificate_type_name:"Kalibrasi Tangki",object_type:"Tangki Uji",installation_location:"Denpasar",expiry_date:"2026-12-31",is_active:true,is_example:false}});
  const chain={select:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,maybeSingle:async()=>result(),single:async()=>result(),then:(resolve:(r:unknown)=>unknown)=>Promise.resolve(result()).then(resolve)};return chain;
 });
});
afterEach(()=>vi.unstubAllEnvs());
async function confirmedInput(){const {data}=await getRenewalEmailPreview({certificate,branch});const d=data!;const email=renderRenewalEmail({...d.context,pic:d.demoContact.name},d.template,"test");return {certificate,branch,mode:"test",confirmed:true,fingerprint:await emailFingerprint({certificate,branch,recipient:d.demoContact.email,subject:email.subject,body:email.body,mode:"test"})};}
describe("confirmed server-rendered sending",()=>{
 it("requires explicit confirmation and a hash of the current preview",async()=>{expect((await requestRenewalEmailSend({certificate,branch,mode:"test"})).error).toContain("konfirmasikan");expect(mocks.rpc).not.toHaveBeenCalled();});
 it("queues canonical content and processes only that authorized job",async()=>{const r=await requestRenewalEmailSend(await confirmedInput());expect(r).toMatchObject({ok:true,job,state:"accepted"});expect(mocks.rpc).toHaveBeenCalledWith("enqueue_client_renewal_email",expect.objectContaining({b:branch,certificate,delivery_mode:"test",email_subject:expect.stringContaining("[UJI INTERNAL]")}));expect(mocks.worker).toHaveBeenCalledWith({branch,job});});
 it("rejects changed template content after preview without queuing anything",async()=>{const input=await confirmedInput();mocks.template.mockResolvedValue({...DEFAULT_EMAIL_TEMPLATE,subject:"Pembaruan {nama_layanan} — {nama_pelanggan}"});expect((await requestRenewalEmailSend(input)).error).toContain("telah berubah");expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.worker).not.toHaveBeenCalled();});
 it("refuses caller-controlled recipients and arbitrary bodies even with confirmation",async()=>{const input=await confirmedInput();for(const extra of [{recipient:"external@example.invalid"},{body:"forged message"},{access_token:"forged token"}])expect((await requestRenewalEmailSend({...input,...extra})).error).toContain("tidak valid");expect(mocks.rpc).not.toHaveBeenCalled();});
 it("does not permit AM to use administrator test delivery",async()=>{mocks.context.mockResolvedValue({branch,user:{id:"ad920000-0000-4000-8000-000000000001"},scopes:[{role_code:"account_manager",branch_code:branch}]});expect((await requestRenewalEmailSend(await confirmedInput())).error).toContain("hanya untuk Admin");expect(mocks.rpc).not.toHaveBeenCalled();});
 it("does not allow official delivery in test mode",async()=>{expect((await requestRenewalEmailSend({certificate,branch,mode:"official",confirmed:true,fingerprint:"a".repeat(64)})).error).toContain("belum diaktifkan");expect(mocks.rpc).not.toHaveBeenCalled();});
});
