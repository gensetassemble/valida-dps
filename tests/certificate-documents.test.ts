import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ user: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireActiveUser: mocks.user }));
vi.mock("@/features/master-data/server", () => ({ masterClient: mocks.client, entityContext: vi.fn() }));
import { GET } from "@/app/api/documents/route";
const id = "c2d72974-2e64-46a7-bb42-e5511decd4aa";
describe("private certificate preview", () => {
  beforeEach(() => vi.resetAllMocks());
  it("does not fetch storage when the session cannot read document metadata", async () => {
    const storage = vi.fn();
    mocks.client.mockResolvedValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }), storage: { from: storage } });
    const response = await GET(new NextRequest(`https://valida.example/api/documents?id=${id}&preview=1`));
    expect(response.status).toBe(404);
    expect(storage).not.toHaveBeenCalled();
  });
  it("returns PDF bytes without exposing a signed URL and forbids caching", async () => {
    const download = vi.fn().mockResolvedValue({ data: new Blob(["%PDF-1.7 test"]), error: null });
    mocks.client.mockResolvedValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { object_path: "DPS/personnel/private.pdf" } }) }) }) }), storage: { from: () => ({ download }) } });
    const response = await GET(new NextRequest(`https://valida.example/api/documents?id=${id}&preview=1`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).toBe("%PDF-1.7 test");
    expect(download).toHaveBeenCalledWith("DPS/personnel/private.pdf");
  });
  it("does not report a missing storage object as a PDF", async () => {
    mocks.client.mockResolvedValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { object_path: "missing.pdf" } }) }) }) }), storage: { from: () => ({ download: async () => ({ data: null, error: {} }) }) } });
    expect((await GET(new NextRequest(`https://valida.example/api/documents?id=${id}&preview=1`))).status).toBe(404);
  });
  it("requires an active session before looking up documents", async () => {
    mocks.user.mockRejectedValue(new Error("unauthenticated"));
    await expect(GET(new NextRequest(`https://valida.example/api/documents?id=${id}&preview=1`))).rejects.toThrow("unauthenticated");
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
