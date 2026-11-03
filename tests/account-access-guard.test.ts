import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn() }));
vi.mock("server-only", () => ({}));
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
  }),
}));
import { requireActiveUser } from "@/lib/auth/guards";
describe("application access requires an assigned active role", () => {
  let grants: Record<string, unknown>[];
  beforeEach(() => {
    grants = [];
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
              : [{ code: "DPS", name: "QA branch" }],
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
});
