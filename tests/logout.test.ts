import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  getAll: vi.fn(),
  set: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => {
    throw new Error("Logout must not refresh Auth");
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: mocks.getAll, set: mocks.set }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signOut: mocks.signOut } }),
}));
vi.mock("@/lib/env/public", () => ({
  getSupabaseConfig: () => ({
    url: "https://qa-project.supabase.co",
    key: "sb_publishable_test",
  }),
}));
import { POST } from "../src/app/auth/logout/route";
import { proxy } from "../src/proxy";

describe("full-document logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAll.mockReturnValue([
      { name: "sb-qa-project-auth-token.0" },
      { name: "sb-qa-project-auth-token.1" },
      { name: "sb-qa-project-auth-token-code-verifier" },
      { name: "unrelated-preference" },
      { name: "sb-other-project-auth-token" },
    ]);
    mocks.signOut.mockResolvedValue({ error: null });
  });
  it("returns a 303 login redirect and expires every chunk for this project", async () => {
    const response = await POST(
      new NextRequest("https://valida.example.invalid/auth/logout", {
        method: "POST",
        headers: { origin: "https://valida.example.invalid" },
      }),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://valida.example.invalid/login",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.set.mock.calls.map((c) => c[0])).toEqual([
      "sb-qa-project-auth-token.0",
      "sb-qa-project-auth-token.1",
      "sb-qa-project-auth-token-code-verifier",
    ]);
    for (const call of mocks.set.mock.calls)
      expect(call[2]).toMatchObject({ maxAge: 0, path: "/" });
  });
  it("still clears the local session and redirects if the Auth network fails", async () => {
    mocks.signOut.mockRejectedValue(new Error("Auth unavailable"));
    const response = await POST(
      new NextRequest("https://valida.example.invalid/auth/logout", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(303);
    expect(mocks.set).toHaveBeenCalledTimes(3);
  });
  it("expires cookies when Auth returns an error response", async () => {
    mocks.signOut.mockResolvedValue({
      error: new Error("Auth retry unavailable"),
    });
    const response = await POST(
      new NextRequest("https://valida.example.invalid/auth/logout", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(303);
    expect(mocks.set).toHaveBeenCalledTimes(3);
  });
  it("does not refresh Auth in the proxy before a logout request", async () => {
    const response = await proxy(
      new NextRequest("https://valida.example.invalid/auth/logout", {
        method: "POST",
      }),
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("rejects a cross-site request without changing a session", async () => {
    const response = await POST(
      new NextRequest("https://valida.example.invalid/auth/logout", {
        method: "POST",
        headers: {
          origin: "https://outside.example.invalid",
          "sec-fetch-site": "cross-site",
        },
      }),
    );
    expect(response.status).toBe(403);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
