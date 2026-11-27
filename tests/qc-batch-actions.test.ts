import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ guard: vi.fn(), client: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("@/lib/auth/guards", () => ({ requireActiveUser: m.guard }));
vi.mock("@/features/master-data/server", () => ({ masterClient: m.client }));
import { submitQcFindings } from "@/features/qc/actions";

const record = "ac110000-0000-4000-8000-000000000001";
const findings = [1, 2].map(n => ({ requestId: `ac120000-0000-4000-8000-${String(n).padStart(12, "0")}`, title: `Temuan ${n}`, body: `Catatan perbaikan ${n}` }));
const ids = ["ac130000-0000-4000-8000-000000000001", "ac130000-0000-4000-8000-000000000002"];
describe("QC multi-point submission", () => {
  beforeEach(() => {
    vi.resetAllMocks(); m.guard.mockResolvedValue({}); m.client.mockResolvedValue({ rpc: m.rpc });
    m.rpc.mockResolvedValue({ data: ids, error: null });
  });
  it.each(["personnel", "calibration"])("sends %s findings in one atomic RPC with stable retry identifiers", async domain => {
    const input = { branch: "DPS", domain, record, findings };
    expect(await submitQcFindings(input)).toEqual({ ids });
    expect(m.rpc).toHaveBeenCalledTimes(1);
    expect(m.rpc).toHaveBeenCalledWith("submit_certificate_qc_batch", { b: "DPS", d: domain, r: record, findings });
    await submitQcFindings(input);
    expect(m.rpc.mock.calls[1]).toEqual(m.rpc.mock.calls[0]);
    expect(m.revalidate).toHaveBeenCalledWith("/notifikasi");
  });
  it.each([
    [], Array.from({ length: 21 }, (_, n) => ({ ...findings[0], requestId: `ac120000-0000-4000-8000-${String(n).padStart(12, "0")}` })),
    [findings[0], findings[0]], [{ ...findings[0], title: "  " }], [{ ...findings[0], body: "\n" }],
    [{ ...findings[0], body: "x".repeat(4001) }], [{ ...findings[0], created_by: record }],
  ].map(invalid => ({ invalid })))("rejects invalid or duplicated input before opening a database connection: %o", async ({ invalid }) => {
    expect((await submitQcFindings({ branch: "DPS", domain: "personnel", record, findings: invalid })).error).toBeTruthy();
    expect(m.client).not.toHaveBeenCalled(); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("keeps database authorization authoritative and does not report a successful batch on denial", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect((await submitQcFindings({ branch: "DPS", domain: "personnel", record, findings })).error).toMatch(/QSHE/);
    expect(m.revalidate).not.toHaveBeenCalled();
  });
  it("requires an active session before calling the RPC", async () => {
    m.guard.mockRejectedValue(Error("Not authenticated"));
    await expect(submitQcFindings({ branch: "DPS", domain: "personnel", record, findings })).rejects.toThrow();
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("refuses to confirm a truncated result", async () => {
    m.rpc.mockResolvedValue({ data: [ids[0]], error: null });
    await expect(submitQcFindings({ branch: "DPS", domain: "personnel", record, findings })).rejects.toThrow(/belum dapat dikonfirmasi/);
    expect(m.revalidate).not.toHaveBeenCalled();
  });
});
