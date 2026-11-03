import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
import { hasSecondFactor, hasRecoverySession } from "@/lib/auth/security";
describe("verified authentication security boundaries", () => {
  it("requires AAL2 and fails closed on MFA errors", async () => {
    for (const [level, error, allowed] of [["aal1", null, false], ["aal2", null, true], ["aal2", {}, false]] as const) {
      const db = { auth: { mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: level }, error }) } } } as unknown as SupabaseClient;
      expect(await hasSecondFactor(db)).toBe(allowed);
    }
  });
  it("requires an Auth user and Auth-backed recovery session, not just login", async () => {
    const rpc = vi.fn();
    const db = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "fixture" } }, error: null }) }, rpc } as unknown as SupabaseClient;
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await hasRecoverySession(db)).toBe(false);
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await hasRecoverySession(db)).toBe(true);
    rpc.mockResolvedValue({ data: true, error: {} });
    expect(await hasRecoverySession(db)).toBe(false);
  });
});
