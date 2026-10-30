import { describe, it, expect } from "vitest";
import { employeeStatusSchema } from "@/features/workflows/employee-status-model";
import { recordSchema } from "@/features/master-data/validation";
import { ENTITIES } from "@/features/master-data/registry";

describe("HRGA employee lifecycle", () => {
  const decision = { status: "inactive", reason: "resigned", effective_on: "2026-01-01", notes: "Keputusan sesuai dokumen organisasi" };
  it("requires an explanation, a real past/present date and the correct reason", () => {
    expect(employeeStatusSchema.safeParse(decision).success).toBe(true);
    for (const patch of [{ notes: "" }, { effective_on: "2026-02-31" }, { effective_on: "2999-01-01" }, { reason: "reactivated" }, { status: "active" }])
      expect(employeeStatusSchema.safeParse({ ...decision, ...patch }).success).toBe(false);
    expect(employeeStatusSchema.safeParse({ ...decision, status: "active", reason: "reactivated" }).success).toBe(true);
  });
  it("rejects lifecycle changes through the generic identity form", () => {
    const identity = { full_name: "[CONTOH] Personil", npp: "00001", position: "", employment_category: "", organization_unit: "", verification_status: "pending", verification_note: "" };
    expect(recordSchema(ENTITIES.pegawai, true).safeParse(identity).success).toBe(true);
    expect(recordSchema(ENTITIES.pegawai, true).safeParse({ ...identity, employment_status: "inactive" }).success).toBe(false);
    expect(recordSchema(ENTITIES.pegawai, true).safeParse({ ...identity, is_active: false }).success).toBe(false);
  });
});
