import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), secondFactor: vi.fn() }));
vi.mock("@/lib/auth/mfa-context", () => ({ mfaContext: mocks.context }));
vi.mock("@/lib/auth/security", () => ({ hasSecondFactor: mocks.secondFactor }));
import { startMfaEnrollment, verifyMfaCode } from "@/app/(auth)/mfa/actions";

describe("MFA ownership and enrollment gates", () => {
  const id = "ae300000-0000-4000-8000-000000000001";
  const mfa = { listFactors: vi.fn(), enroll: vi.fn(), unenroll: vi.fn(), challengeAndVerify: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.context.mockResolvedValue({ auth: { mfa } });
    mocks.secondFactor.mockResolvedValue(false);
    mfa.listFactors.mockResolvedValue({ data: { all: [] }, error: null });
    mfa.enroll.mockResolvedValue({ data: { id, totp: { qr_code: "data:image/svg+xml;utf8,fixture" } }, error: null });
    mfa.unenroll.mockResolvedValue({ error: null });
    mfa.challengeAndVerify.mockResolvedValue({ error: null });
  });
  it("does not enroll an unauthenticated or inactive account", async () => {
    mocks.context.mockRejectedValue(new Error("inactive"));
    expect((await startMfaEnrollment()).error).toBeTruthy();
    expect(mfa.enroll).not.toHaveBeenCalled();
  });
  it("requires the existing verified factor before adding another", async () => {
    mfa.listFactors.mockResolvedValue({ data: { all: [{ id, factor_type: "totp", status: "verified" }] } });
    expect((await startMfaEnrollment()).error).toMatch(/sudah terdaftar/);
    expect(mfa.unenroll).not.toHaveBeenCalled();
    expect(mfa.enroll).not.toHaveBeenCalled();
  });
  it("only replaces an owned incomplete TOTP during enrollment", async () => {
    mfa.listFactors.mockResolvedValue({ data: { all: [{ id, factor_type: "totp", status: "unverified" }] } });
    expect(await startMfaEnrollment()).toEqual({ id, qr: "data:image/svg+xml;utf8,fixture" });
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: id });
  });
  it("rejects a factor that is not in the authenticated user's list", async () => {
    expect((await verifyMfaCode({ factorId: id, code: "123456" })).error).toBeTruthy();
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
  });
  it("rejects malformed codes before touching Auth", async () => {
    expect((await verifyMfaCode({ factorId: id, code: "12345x" })).error).toBeTruthy();
    expect(mocks.context).not.toHaveBeenCalled();
  });
  it("passes only owned factor and six-digit code to Auth", async () => {
    mfa.listFactors.mockResolvedValue({ data: { all: [{ id, factor_type: "totp", status: "verified" }] } });
    expect(await verifyMfaCode({ factorId: id, code: "123456" })).toEqual({ ok: true });
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: id, code: "123456" });
  });
});
