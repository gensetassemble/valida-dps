import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn(), secondFactor: vi.fn(), rpc:vi.fn(),mode:vi.fn() }));
vi.mock("@/lib/auth/security", () => ({ hasSecondFactor: mocks.secondFactor }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers",()=>({cookies:async()=>({get:mocks.mode})}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Error("REDIRECT:" + to);
  },
}));
vi.mock("@/lib/env/public", () => ({
  getSupabaseConfig: () => ({ url: "https://example.invalid" }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    rpc: mocks.rpc,
  }),
}));
import { requireActiveUser } from "@/lib/auth/guards";
describe("application access requires an assigned active role", () => {
  let grants: Record<string, unknown>[];
  beforeEach(() => {
    grants = [];
    mocks.mode.mockReturnValue(undefined);
    mocks.rpc.mockResolvedValue({data:false,error:null});
    mocks.secondFactor.mockResolvedValue(true);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "qa-user" } },
      error: null,
    });
    mocks.from.mockImplementation((table: string) => {
      const result = () => ({
        data:
          table === "profiles"
            ? { id: "qa-user", is_active: true, branch_code: "DPS" }
            : table === "user_role_assignments"
              ? grants
              : table==="simulation_workspaces" ? (grants.some(g=>g.branch_code==="SIMDPS")?[{branch_code:"SIMDPS"}]:[]) : [{ code: "DPS", name: "QA branch" },{code:"SIMDPS",name:"Simulation"}],
        error: null,
      });
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        order: () => chain,
        single: async () => result(),
        then: (resolve: (r: unknown) => unknown) =>
          Promise.resolve(result()).then(resolve),
      };
      return chain;
    });
  });
  it("explains an unassigned account instead of loading a failing dashboard", async () => {
    await expect(requireActiveUser()).rejects.toThrow(
      "REDIRECT:/login?status=unassigned",
    );
  });
  it("allows a tester session using the explicitly granted branch", async () => {
    grants = [{ role_code: "tester", branch_code: "DPS" }];
    expect((await requireActiveUser()).scopes).toEqual([
      { role_code: "tester", branch_code: "DPS" },
    ]);
  });
  it("does not treat an unknown role as application access", async () => {
    grants = [{ role_code: "unknown-role", branch_code: "DPS" }];
    await expect(requireActiveUser()).rejects.toThrow(
      "REDIRECT:/login?status=unassigned",
    );
  });
  it("keeps normal reader sessions unchanged until simulation is explicitly enabled",async()=>{
    grants=[{role_code:"tester",branch_code:"DPS"},{role_code:"super_admin",branch_code:"SIMDPS"}];
    mocks.secondFactor.mockResolvedValue(false);
    const c=await requireActiveUser();expect(c.isSimulation).toBe(false);expect(c.canSimulate).toBe(true);
    expect(c.scopes).toEqual([{role_code:"tester",branch_code:"DPS"}]);
  });
  it("requires MFA on entering simulation and never combines it with DPS write scope",async()=>{
    grants=[{role_code:"tester",branch_code:"DPS"},{role_code:"super_admin",branch_code:"SIMDPS"}];
    mocks.mode.mockReturnValue({value:"true"});mocks.secondFactor.mockResolvedValue(false);
    await expect(requireActiveUser()).rejects.toThrow("REDIRECT:/mfa");
    mocks.secondFactor.mockResolvedValue(true);const c=await requireActiveUser();
    expect(c.isSimulation).toBe(true);expect(c.profile.branch_code).toBe("SIMDPS");
    expect(c.scopes).toEqual([{role_code:"super_admin",branch_code:"SIMDPS"}]);
  });
  it("requires MFA for privileged sessions", async () => {
    grants = [{ role_code: "super_admin", branch_code: "DPS" }];
    mocks.secondFactor.mockResolvedValue(false);
    await expect(requireActiveUser()).rejects.toThrow("REDIRECT:/mfa");
  });
  it("allows a verified privileged session", async () => {
    grants = [{ role_code: "super_admin", branch_code: "DPS" }];
    expect((await requireActiveUser()).scopes[0].role_code).toBe("super_admin");
  });
  it("redirects a temporary-password account before reading business profile data",async()=>{
    mocks.rpc.mockResolvedValue({data:true,error:null});mocks.from.mockClear();
    await expect(requireActiveUser()).rejects.toThrow("REDIRECT:/initial-password");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("fails closed if the initial-password state cannot be checked",async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:{message:"unavailable"}});
    await expect(requireActiveUser()).rejects.toThrow("Status password awal belum dapat diperiksa");
  });
});
