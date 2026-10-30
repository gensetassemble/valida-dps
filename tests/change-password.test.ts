import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  update: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/guards", () => ({ requireActiveUser: mocks.guard }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { updateUser: mocks.update } }),
}));
vi.mock("@/lib/auth/logout", () => ({ signOutCurrentDevice: mocks.logout }));
import { changeOwnPassword } from "@/app/(dashboard)/profil/actions";
import { changeOwnPasswordSchema } from "@/lib/auth/schemas";
import { ALL_ROLES } from "@/lib/auth/permissions";
const input = {
  currentPassword: "SyntheticOld123!",
  password: "SyntheticNew456!",
  confirmation: "SyntheticNew456!",
};
describe("change own password", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.guard.mockResolvedValue({ user: { id: "current-user" } });
    mocks.update.mockResolvedValue({ error: null });
  });
  for (const role of ALL_ROLES)
    it(`allows ${role} to update only its session's password`, async () => {
      mocks.guard.mockResolvedValue({
        user: { id: "current-user" },
        scopes: [{ branch_code: "DPS", role_code: role }],
      });
      expect(await changeOwnPassword(input)).toEqual({ ok: true });
      expect(mocks.update).toHaveBeenCalledWith({
        password: input.password,
        current_password: input.currentPassword,
      });
      expect(mocks.logout).toHaveBeenCalledOnce();
      expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.logout.mock.invocationCallOrder[0],
      );
    });
  it("rejects unauthenticated or inactive callers before Auth mutation", async () => {
    mocks.guard.mockRejectedValue(new Error("login redirect"));
    await expect(changeOwnPassword(input)).rejects.toThrow("login redirect");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects weak, mismatched, reused passwords and attempts to supply another user's ID", async () => {
    for (const bad of [
      { ...input, password: "short", confirmation: "short" },
      { ...input, confirmation: "different-value" },
      {
        ...input,
        password: input.currentPassword,
        confirmation: input.currentPassword,
      },
      { ...input, id: "another-user" },
    ]) {
      expect(changeOwnPasswordSchema.safeParse(bad).success).toBe(false);
      expect((await changeOwnPassword(bad)).error).toBeTruthy();
    }
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("keeps the session and reports rejection when the current password is wrong", async () => {
    mocks.update.mockResolvedValue({ error: { code: "invalid_credentials" } });
    expect((await changeOwnPassword(input)).error).toContain(
      "password saat ini benar",
    );
    expect(mocks.logout).not.toHaveBeenCalled();
  });
  it("asks for a fresh login if secure password change requires reauthentication", async () => {
    mocks.update.mockResolvedValue({
      error: { code: "reauthentication_needed" },
    });
    expect((await changeOwnPassword(input)).error).toContain(
      "logout dan masuk kembali",
    );
    expect(mocks.logout).not.toHaveBeenCalled();
  });
  it("does not expose network errors or credential values", async () => {
    mocks.update.mockRejectedValue(new Error(input.password));
    const result = await changeOwnPassword(input);
    expect(result.error).toContain("Layanan belum dapat dihubungi");
    expect(JSON.stringify(result)).not.toContain(input.password);
    expect(mocks.logout).not.toHaveBeenCalled();
  });
});
