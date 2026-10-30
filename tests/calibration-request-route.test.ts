import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const auth = vi.hoisted(() => vi.fn());
const single = vi.hoisted(() => vi.fn());
const eq = vi.hoisted(() => vi.fn());
const client = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/guards", () => ({ requireActiveUser: auth }));
vi.mock("@/features/master-data/server", () => ({ masterClient: client }));
import { GET } from "@/app/api/workflows/form/route";
const id = "ab000000-0000-4000-8000-000000000001";
describe("private calibration PDF endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks(); auth.mockResolvedValue({});
    eq.mockReturnValue({ maybeSingle: single });
    client.mockResolvedValue({ from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) }) });
    single.mockResolvedValue({ data: null });
  });
  it("authenticates before querying any record", async () => {
    auth.mockRejectedValue(new Error("login required"));
    await expect(GET(new NextRequest(`https://valida.example/api/workflows/form?id=${id}&format=pdf`))).rejects.toThrow("login required");
    expect(client).not.toHaveBeenCalled();
  });
  it("returns no PDF when RLS hides the requested record", async () => {
    const response = await GET(new NextRequest(`https://valida.example/api/workflows/form?id=${id}&format=pdf`));
    expect(response.status).toBe(404); expect(eq).toHaveBeenCalledWith("id", id);
  });
  it("returns an actual private PDF attachment for a saved draft", async () => {
    single.mockResolvedValue({ data: { id, request_number: "[CONTOH] DRAFT", equipment_snapshot: { name: "[CONTOH] Alat" } } });
    const response = await GET(new NextRequest(`https://valida.example/api/workflows/form?id=${id}&format=pdf&download=1`));
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toMatch(/^attachment; filename="FOR-SCI-UMA-197-.*\.pdf"$/);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  });
});
