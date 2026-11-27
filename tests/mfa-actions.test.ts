import { describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ context: vi.fn(), enroll: vi.fn(), verify: vi.fn() }));
vi.mock("@/lib/auth/mfa-context", () => ({ mfaContext: auth.context }));
import { startMfaEnrollment, verifyMfaCode } from "@/app/(auth)/mfa/actions";
describe("retired MFA actions", () => {
  it("does not enroll an authenticator through a previously opened client", async () => {
    expect((await startMfaEnrollment()).error).toMatch(/email dan password/);
    expect(auth.context).not.toHaveBeenCalled();
  });
  it("does not request an authenticator code or change the Auth session", async () => {
    expect((await verifyMfaCode({ factorId: "old-factor", code: "123456" })).error).toMatch(/email dan password/);
    expect(auth.context).not.toHaveBeenCalled();
  });
});
