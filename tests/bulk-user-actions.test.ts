import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({guard:vi.fn(),mfa:vi.fn(),client:vi.fn(),admin:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("next/navigation",()=>({unstable_rethrow:()=>{}}));
vi.mock("@/lib/auth/guards",()=>({requireActiveUser:m.guard}));vi.mock("@/lib/auth/security",()=>({hasSecondFactor:m.mfa}));vi.mock("@/features/master-data/server",()=>({masterClient:m.client}));vi.mock("@/lib/supabase/auth-admin",()=>({getAuthAdminClient:m.admin}));
import {previewBulkUsers,createBulkUser} from "@/features/bulk-users/actions";
describe("MFA-bound bulk creation",()=>{
 const employee={id:"ef200000-0000-4000-8000-000000000001",full_name:"Nama Pegawai",npp:"04125",employment_status:"active",is_active:true,updated_at:"2026-11-10T00:00:00Z"};
 const input=[{name:"Nama Pegawai",npp:"04125",email:"staff@example.invalid",roles:["tester"]}];
 let committed=false;const rpc=vi.fn(),createUser=vi.fn(),deleteUser=vi.fn();
 function query(data:unknown){const q:Record<string,unknown>={};for(const f of ["select","eq","ilike","lte","in","limit"])q[f]=vi.fn(()=>q);q.maybeSingle=vi.fn(async()=>({data:Array.isArray(data)?data[0]||null:data,error:null}));q.then=(resolve:(v:unknown)=>void)=>resolve({data,error:null});return q;}
 beforeEach(()=>{vi.resetAllMocks();committed=false;process.env.BULK_USER_REVIEW_SECRET="synthetic-review-signing-key-".repeat(4);process.env.BULK_USER_INITIAL_PASSWORD="SyntheticPassword123!";
  m.guard.mockResolvedValue({user:{id:"admin-1"},scopes:[{branch_code:"DPS",role_code:"super_admin"}]});m.mfa.mockResolvedValue(true);
  m.client.mockResolvedValue({from:(table:string)=>query(table==="employee_directory_records"?[employee]:[]),rpc});
  createUser.mockResolvedValue({data:{user:{id:"new-auth-id"}},error:null});deleteUser.mockResolvedValue({error:null});rpc.mockResolvedValue({data:"new-auth-id",error:null});
  m.admin.mockReturnValue({auth:{admin:{createUser,deleteUser}},from:()=>query(committed?{id:"new-auth-id"}:null)});
 });
 async function review(){const r=await previewBulkUsers("DPS",input);expect(r.error).toBeUndefined();return r.token!;}
 it("does not create Auth during preview and creates only the reviewed identity without sending email",async()=>{
  const token=await review();expect(createUser).not.toHaveBeenCalled();expect((await createBulkUser(token,0)).status).toBe("success");
  expect(createUser).toHaveBeenCalledWith({email:input[0].email,password:"SyntheticPassword123!",email_confirm:true});expect(rpc).toHaveBeenCalledWith("provision_bulk_user",expect.objectContaining({b:"DPS",role_codes:["tester"],details:expect.objectContaining({employee_id:employee.id,npp:"04125"})}));
 });
 it("rejects tampered previews, a different operator, and lost MFA before Auth creation",async()=>{
  const token=await review();expect((await createBulkUser(token+"x",0)).status).toBe("error");m.guard.mockResolvedValue({user:{id:"admin-2"},scopes:[{branch_code:"DPS",role_code:"super_admin"}]});expect((await createBulkUser(token,0)).status).toBe("error");m.mfa.mockResolvedValue(false);expect((await createBulkUser(token,0)).status).toBe("error");expect(createUser).not.toHaveBeenCalled();
 });
 it("cleans a new Auth identity only when profile rollback is confirmed",async()=>{
  const token=await review();rpc.mockResolvedValue({error:{code:"23514"},data:null});expect((await createBulkUser(token,0)).status).toBe("error");expect(deleteUser).toHaveBeenCalledWith("new-auth-id");
 });
 it("preserves a committed profile after an ambiguous transport failure",async()=>{
  const token=await review();committed=true;rpc.mockResolvedValue({error:{message:"fetch interrupted"},data:null});expect((await createBulkUser(token,0)).status).toBe("error");expect(deleteUser).not.toHaveBeenCalled();
 });
});
