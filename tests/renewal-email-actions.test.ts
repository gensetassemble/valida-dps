import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({context:vi.fn(),from:vi.fn(),rpc:vi.fn(),template:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/features/master-data/server",()=>({entityContext:mocks.context,masterClient:async()=>({from:mocks.from,rpc:mocks.rpc})}));
vi.mock("@/features/operations/email-server",()=>({loadEmailTemplate:mocks.template}));
import {getRenewalEmailPreview,requestRenewalEmailSend,saveRenewalEmailTemplate,recordClientContact} from "@/features/operations/email-actions";
import {DEFAULT_EMAIL_TEMPLATE} from "@/features/operations/renewal-email";
import {recordRenewalFollowup} from "@/features/operations/actions";
const certificate="bc900000-0000-4000-8000-000000000001",branch="DPS";
beforeEach(()=>{
 vi.clearAllMocks();mocks.context.mockResolvedValue({branch,scopes:[{role_code:"account_manager",branch_code:branch}]});mocks.template.mockResolvedValue(DEFAULT_EMAIL_TEMPLATE);
 mocks.from.mockImplementation((table:string)=>{
  const result=()=>({data:table === "client_contacts" ? [{id:"bc900000-0000-4000-8000-000000000002",email:"qa@sucofindo.co.id",name:"PIC",is_test:true,is_primary:true,verification_status:"verified"}] : table === "renewal_opportunities" ? {stage:"uncontacted"} : {id:certificate,client_id:"client",client_name:"Client",certificate_type_name:"Residual Disinsection",is_active:true,is_example:false},error:null});
  const chain={select:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,maybeSingle:async()=>result(),then:(resolve:(r:unknown)=>unknown)=>Promise.resolve(result()).then(resolve)};return chain;
 });
});
describe("server-enforced email fallback",()=>{
 it("loads only an authorized certificate and its database contacts",async()=>{
  const result=await getRenewalEmailPreview({certificate,branch});expect(mocks.context).toHaveBeenCalledWith("sertifikat-klien",branch,true);expect(result.data?.contacts[0].email).toBe("qa@sucofindo.co.id");expect(result.data?.provider.enabled).toBe(false);
 });
 it("does not fabricate success or add follow-ups on repeated official requests",async()=>{
  for(let i=0;i<2;i++)expect((await requestRenewalEmailSend({certificate,branch,mode:"official"})).error).toContain("Pengiriman belum tersedia");
  expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("provides the approved Adli demo for AM without an official PIC or a manual service field",async()=>{
  const {data}=await getRenewalEmailPreview({certificate,branch});
  expect(data?.isAdmin).toBe(false);expect(data?.demoMode).toBe(true);
  expect(data?.demoContact).toEqual({name:"[UJI] Adli Alfian",email:"adli.alfian@sucofindo.co.id"});
  expect(data?.testRecipients).toEqual(["adli.alfian@sucofindo.co.id"]);
  expect(data?.context.serviceName).toBe("Residual Disinsection");expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("rejects recipient/token injection and refuses test sends for non-admins",async()=>{
  expect((await requestRenewalEmailSend({certificate,branch,mode:"test"})).error).toContain("hanya untuk Admin");
  for(const extra of [{recipient:"external@example.com"},{access_token:"fake"},{status:"delivered"}])expect((await requestRenewalEmailSend({certificate,branch,mode:"official",...extra})).error).toContain("tidak valid");
  expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("rejects template changes by AM and stale admin versions",async()=>{
  const input={branch,...DEFAULT_EMAIL_TEMPLATE};expect((await saveRenewalEmailTemplate(input)).error).toContain("hanya untuk Admin");
  mocks.context.mockResolvedValue({branch,scopes:[{role_code:"super_admin",branch_code:branch}]});mocks.rpc.mockResolvedValue({error:{code:"40001"},data:null});
  expect((await saveRenewalEmailTemplate(input)).error).toContain("Muat ulang");
 });
 it("does not count email to a test contact as a real customer contact",async()=>{
  const result=await recordRenewalFollowup({certificate,branch,target:"contacted",note:"Test activity only",document:null,details:{pic_name:"PIC",channel:"email",recipient_email:"qa@sucofindo.co.id",subject:"Test coordination",confirmed:true}});
  expect(result.error).toContain("kontak uji internal");expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("propagates access denial before reading any certificate/contact",async()=>{
  mocks.context.mockRejectedValue(Error("Access denied"));await expect(getRenewalEmailPreview({certificate,branch})).rejects.toThrow("Access denied");expect(mocks.from).not.toHaveBeenCalled();
 });
 it("rejects test contacts for every channel without a business mutation",async()=>{
  for(const channel of ["email","phone","whatsapp","meeting"])
    expect((await recordClientContact({certificate,branch,contact:"bc900000-0000-4000-8000-000000000002",channel,note:"Simulasi kontak saja",confirmed:true,expectedStage:"uncontacted"})).error).toContain("PIC utama terverifikasi");
  expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("does not accept a caller-supplied PIC name, email or arbitrary destination stage",async()=>{
  const base={certificate,branch,contact:"bc900000-0000-4000-8000-000000000002",channel:"email",note:"Sudah berkomunikasi",confirmed:true,expectedStage:"uncontacted"};
  for(const extra of [{recipient_email:"external@example.com"},{pic_name:"Forged"},{target:"offered"}])
    expect((await recordClientContact({...base,...extra})).error).toContain("Pilih PIC resmi");
  expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("records the database PIC once and moves only an uncontacted/deferred card to contacted",async()=>{
  let stage="uncontacted";
  mocks.from.mockImplementation((table:string)=>{
    const filters:Record<string,unknown>={};
    const result=()=>({data:table === "client_contacts" ? filters.is_test === true ? [] : [{id:"bc900000-0000-4000-8000-000000000002",name:"PIC Resmi",email:"pic@example.invalid",is_test:false,is_primary:true,verification_status:"verified"}] : table === "renewal_opportunities" ? {stage} : {id:certificate,client_id:"client",client_name:"Client",certificate_type_name:"Residual Disinsection",is_active:true,is_example:false},error:null});
    const chain={select:()=>chain,eq:(key:string,value:unknown)=>{filters[key]=value;return chain;},order:()=>chain,limit:()=>chain,maybeSingle:async()=>result(),then:(resolve:(r:unknown)=>unknown)=>Promise.resolve(result()).then(resolve)};return chain;
  });
  mocks.rpc.mockImplementation(async()=>{stage="contacted";return {error:null};});
  const input={certificate,branch,contact:"bc900000-0000-4000-8000-000000000002",channel:"email",note:"PIC meminta jadwal minggu depan",confirmed:true,expectedStage:"uncontacted"};
  expect(await recordClientContact(input)).toEqual({ok:true});
  expect(mocks.rpc).toHaveBeenCalledWith("record_renewal_followup",expect.objectContaining({target:"contacted",details:expect.objectContaining({pic_name:"PIC Resmi",recipient_email:"pic@example.invalid"})}));
  expect((await recordClientContact(input)).error).toContain("Status kartu telah berubah");expect(mocks.rpc).toHaveBeenCalledTimes(1);
  stage="offered";await recordClientContact({...input,expectedStage:"offered",note:"PIC sudah menerima penawaran resmi"});
  expect(mocks.rpc).toHaveBeenLastCalledWith("record_renewal_followup",expect.objectContaining({target:null}));
 });
});
