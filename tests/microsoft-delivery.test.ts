import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({token:vi.fn(),fetch:vi.fn()}));
vi.mock("@azure/msal-node",()=>({ConfidentialClientApplication:class{acquireTokenByClientCredential=mocks.token;}}));
import {deliverMicrosoftEmail} from "@/lib/microsoft/delivery";
import {getMailDeliveryConfig,MAIL_TEST_RECIPIENT} from "@/lib/microsoft/delivery-config";
const message={id:"00000000-0000-4000-8000-000000000001",kind:"renewal" as const,to:"customer@example.invalid",subject:"Uji email",body:"Dokumen <script>tidak boleh berupa HTML mentah</script>",test:true};
beforeEach(()=>{
 vi.resetAllMocks();vi.stubGlobal("fetch",mocks.fetch);
 for(const [k,v] of Object.entries({ENABLE_OUTLOOK_EMAIL:"true",VALIDA_MAIL_MODE:"test",MICROSOFT_TENANT_ID:"00000000-0000-4000-8000-000000000001",MICROSOFT_CLIENT_ID:"00000000-0000-4000-8000-000000000002",MICROSOFT_CLIENT_SECRET:"synthetic-never-a-real-key",OUTLOOK_NOTIFICATION_MAILBOX:"valida-uji@sucofindo.co.id",APP_ENVIRONMENT:"development",VERCEL_ENV:""}))vi.stubEnv(k,v);
 mocks.token.mockResolvedValue({accessToken:"synthetic-token"});
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe("Microsoft 365 delivery boundary",()=>{
 it("stays closed until switches and mailbox configuration are complete",async()=>{
  vi.stubEnv("ENABLE_OUTLOOK_EMAIL","false");expect(getMailDeliveryConfig()).toBeNull();expect((await deliverMicrosoftEmail(message)).code).toBe("INTEGRATION_DISABLED");expect(mocks.token).not.toHaveBeenCalled();expect(mocks.fetch).not.toHaveBeenCalled();
 });
 it("blocks live delivery from a development environment",()=>{vi.stubEnv("VALIDA_MAIL_MODE","live");expect(getMailDeliveryConfig()).toBeNull();});
 it("routes every test to Adli, escapes body HTML and records 202 as accepted only",async()=>{
  mocks.fetch.mockResolvedValue(new Response(null,{status:202,headers:{"request-id":"synthetic-request"}}));
  const result=await deliverMicrosoftEmail(message);expect(result).toEqual({state:"accepted",code:"GRAPH_ACCEPTED",requestId:"synthetic-request"});
  const [url,options]=mocks.fetch.mock.calls[0];expect(url).toContain("valida-uji%40sucofindo.co.id/sendMail");const payload=JSON.parse(options.body);
  expect(payload.message.toRecipients).toEqual([{emailAddress:{address:MAIL_TEST_RECIPIENT}}]);expect(payload.message.body.content).toContain("&lt;script&gt;");expect(payload.saveToSentItems).toBe(true);expect(mocks.fetch).toHaveBeenCalledTimes(1);
 });
 it.each([500,503,408])("never auto-retries an ambiguous Graph %s response",async(status)=>{
  mocks.fetch.mockResolvedValue(new Response(null,{status}));expect((await deliverMicrosoftEmail(message)).state).toBe("uncertain");expect(mocks.fetch).toHaveBeenCalledTimes(1);
 });
 it("marks a lost response uncertain instead of sending again",async()=>{mocks.fetch.mockRejectedValue(new Error("timeout"));expect((await deliverMicrosoftEmail(message)).state).toBe("uncertain");expect(mocks.fetch).toHaveBeenCalledTimes(1);});
 it("honors explicit throttling with a bounded retry delay",async()=>{mocks.fetch.mockResolvedValue(new Response(null,{status:429,headers:{"retry-after":"120"}}));expect(await deliverMicrosoftEmail(message)).toMatchObject({state:"retry",retryAfter:120});});
 it("does not issue a Graph request when mailbox authorization fails",async()=>{mocks.token.mockRejectedValue(Error("denied"));expect((await deliverMicrosoftEmail(message)).code).toBe("MAILBOX_AUTHORIZATION_REQUIRED");expect(mocks.fetch).not.toHaveBeenCalled();});
 it("does not dispatch reminders when their independent switch is off",async()=>{vi.stubEnv("ENABLE_EMAIL_REMINDERS","false");expect((await deliverMicrosoftEmail({...message,kind:"reminder"})).code).toBe("REMINDERS_DISABLED");expect(mocks.fetch).not.toHaveBeenCalled();});
 it("requires a separate switch for real client messages",async()=>{vi.stubEnv("APP_ENVIRONMENT","production");vi.stubEnv("VALIDA_MAIL_MODE","live");vi.stubEnv("ENABLE_OUTLOOK_COMMERCIAL","false");expect((await deliverMicrosoftEmail({...message,test:false})).code).toBe("COMMERCIAL_DISABLED");expect(mocks.fetch).not.toHaveBeenCalled();});
});
