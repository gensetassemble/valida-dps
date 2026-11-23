import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signOut: vi.fn(),
  signOutCurrentDevice: vi.fn(),
  hasRecoverySession: vi.fn(),
  initialPasswordRequired: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/env/public", () => ({ getSupabaseConfig: () => ({}) }));
vi.mock("@/lib/env/server", () => ({
  getAppConfig: () => ({ APP_URL: "https://example.com" }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/lib/auth/security", () => ({
  hasRecoverySession: mocks.hasRecoverySession,
}));
vi.mock("@/lib/auth/initial-password", () => ({
  initialPasswordRequired: mocks.initialPasswordRequired,
}));
vi.mock("@/lib/auth/logout", () => ({
  signOutCurrentDevice: mocks.signOutCurrentDevice,
}));

import { resetPassword, updatePassword } from "@/app/(auth)/actions";
import { changeInitialPassword } from "@/app/(auth)/initial-password/actions";
import { MANAGED_PASSWORD_MESSAGE } from "@/lib/auth/password-policy";

const auth = {
  getUser: mocks.getUser,
  updateUser: mocks.updateUser,
  resetPasswordForEmail: mocks.resetPasswordForEmail,
  signOut: mocks.signOut,
};

describe("managed account password actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createClient.mockResolvedValue({ auth });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "tester-user", email: "tester@tester.com" } },
      error: null,
    });
    mocks.hasRecoverySession.mockResolvedValue(true);
    mocks.initialPasswordRequired.mockResolvedValue(true);
  });

  it("does not send a recovery email for the shared tester account", async () => {
    expect(await resetPassword({ email: "tester@tester.com" })).toEqual({
      message:
        "Jika akun memenuhi syarat, petunjuk pemulihan akan dikirim ke alamat tersebut.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("blocks a recovery-session password update", async () => {
    expect(
      await updatePassword({ password: "SyntheticNew456!" }),
    ).toEqual({ error: MANAGED_PASSWORD_MESSAGE });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("blocks the initial-password action", async () => {
    expect(
      await changeInitialPassword({
        currentPassword: "SyntheticOld123!",
        password: "SyntheticNew456!",
        confirmation: "SyntheticNew456!",
      }),
    ).toEqual({ error: MANAGED_PASSWORD_MESSAGE });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.signOutCurrentDevice).not.toHaveBeenCalled();
  });
});
