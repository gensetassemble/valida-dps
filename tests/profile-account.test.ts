import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  databaseError: vi.fn(() => "Database error"),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/auth-admin", () => ({
  getAuthAdminClient: mocks.admin,
}));
vi.mock("@/features/master-data/server", () => ({
  publicDatabaseError: mocks.databaseError,
}));
import { saveProfileAccount } from "@/features/master-data/profile-account";

describe("Super Admin account provisioning", () => {
  const rpc = vi.fn();
  const createUser = vi.fn(),
    deleteUser = vi.fn(),
    updateUserById = vi.fn();
  const details = {
    full_name: "Test User",
    email: "test@example.invalid",
    npp: null,
    whatsapp: null,
    is_active: false,
  };
  const run = (extra: Partial<Parameters<typeof saveProfileAccount>[0]> = {}) =>
    saveProfileAccount({
      db: { rpc } as unknown as SupabaseClient,
      branch: "DPS",
      details,
      superAdmin: true,
      ...extra,
    });
  beforeEach(() => {
    vi.resetAllMocks();
    rpc.mockResolvedValue({ data: "test-id", error: null });
    createUser.mockResolvedValue({
      data: { user: { id: "test-id" } },
      error: null,
    });
    deleteUser.mockResolvedValue({ error: null });
    updateUserById.mockResolvedValue({ error: null });
    mocks.admin.mockReturnValue({
      auth: { admin: { createUser, deleteUser, updateUserById } },
    });
  });
  it("links existing Auth identity without privileged credentials when password is blank", async () => {
    expect(await run({ superAdmin: false })).toEqual({ id: "test-id" });
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("save_profile_identity", {
      b: "DPS",
      profile: null,
      details,
    });
  });
  it("rejects ordinary Admin password operations before any write", async () => {
    expect(
      (await run({ password: "SyntheticPassword123!", superAdmin: false }))
        .error,
    ).toMatch(/Super Admin/);
    expect(rpc).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });
  it("requires a server admin key before writes", async () => {
    mocks.admin.mockReturnValue(null);
    expect((await run({ password: "SyntheticPassword123!" })).error).toMatch(
      /belum dikonfigurasi/,
    );
    expect(rpc).not.toHaveBeenCalled();
  });
  it("creates Auth without email and keeps password outside profile RPC payload", async () => {
    expect(await run({ password: "SyntheticPassword123!" })).toEqual({
      id: "test-id",
    });
    expect(createUser).toHaveBeenCalledWith({
      email: details.email,
      password: "SyntheticPassword123!",
      email_confirm: true,
    });
    expect(rpc.mock.calls[0][1].details).not.toHaveProperty("password");
    expect(updateUserById).not.toHaveBeenCalled();
  });
  it("cleans up only the newly created Auth account if profile validation fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0001" } });
    expect(
      (await run({ password: "SyntheticPassword123!" })).error,
    ).toBeTruthy();
    expect(deleteUser).toHaveBeenCalledWith("test-id");
  });
  it("does not reset an existing password if branch/profile authorization fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await run({ id: "existing-id", password: "SyntheticPassword123!" });
    expect(updateUserById).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it("resets only the server-resolved existing Auth identity after profile authorization", async () => {
    await run({ id: "existing-id", password: "SyntheticPassword123!" });
    expect(updateUserById).toHaveBeenCalledWith("test-id", {
      password: "SyntheticPassword123!",
    });
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(
      updateUserById.mock.invocationCallOrder[0],
    );
    expect(createUser).not.toHaveBeenCalled();
  });
  it("reports a partial save clearly when Auth reset fails", async () => {
    updateUserById.mockResolvedValue({ error: { message: "unavailable" } });
    expect(
      (await run({ id: "existing-id", password: "SyntheticPassword123!" }))
        .error,
    ).toMatch(/Identitas tersimpan, tetapi password/);
  });
});
