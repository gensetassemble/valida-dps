import { describe, it, expect } from "vitest";
import { ENTITIES } from "@/features/master-data/registry";
import { recordSchema, safeSearch } from "@/features/master-data/validation";
import { hasPermission } from "@/lib/auth/permissions";
import { formatBusinessDate, formatRupiah } from "@/lib/format";
describe("Strict master-data payloads", () => {
  it("rejects branch and authorization actor injection", () => {
    expect(
      recordSchema(ENTITIES.wilayah).safeParse({
        name: "Wilayah uji",
        is_active: true,
        branch_code: "OTHER",
      }).success,
    ).toBe(false);
    expect(
      recordSchema(ENTITIES.wilayah).safeParse({
        name: "Wilayah uji",
        is_active: true,
        created_by: "forged",
      }).success,
    ).toBe(false);
  });
  it("retains NPP text and leading zeroes", () => {
    const parsed = recordSchema(ENTITIES.pegawai).parse({
      full_name: "[CONTOH] Pegawai",
      npp: "000001",
      position: "",
      employment_category: "",
      organization_unit: "",
      verification_status: "pending",
      verification_note: "",
    });
    expect(parsed.npp).toBe("000001");
    expect(parsed.position).toBeNull();
  });
  it("rejects expired/malformed assignment date ranges", () => {
    const fields = {
      employee_id: "30000000-0000-4000-8000-000000000001",
      portfolio_id: "40000000-0000-4000-8000-000000000001",
      assignment_type: "personnel",
      effective_from: "2026-10-28",
      effective_until: "2026-10-01",
      verification_status: "pending",
      verification_note: "",
      is_active: true,
    };
    expect(recordSchema(ENTITIES.penugasan).safeParse(fields).success).toBe(
      false,
    );
    expect(
      recordSchema(ENTITIES.penugasan).safeParse({
        ...fields,
        effective_from: "2026-02-31",
        effective_until: "",
      }).success,
    ).toBe(false);
  });
  it("requires grant context and rejects identity reassignment on edit", () => {
    expect(
      recordSchema(ENTITIES["penugasan-peran"]).safeParse({
        profile_id: "20000000-0000-4000-8000-000000000001",
        role_code: "admin",
        grant_reason: "x",
        is_active: true,
      }).success,
    ).toBe(false);
    expect(
      recordSchema(ENTITIES["penugasan-peran"], true).safeParse({
        grant_reason: "Alasan terverifikasi",
        is_active: true,
        role_code: "admin",
      }).success,
    ).toBe(false);
  });
  it("validates reminders without activating cron", () => {
    const common = {
      code: "UJI",
      name: "Jenis uji",
      category: "client",
      regulation_reference: "",
      issuer: "",
      default_validity_months: "",
      is_active: true,
    };
    expect(
      recordSchema(ENTITIES["jenis-sertifikat"]).parse({
        ...common,
        reminder_days: "90,60,30,0",
      }).reminder_days,
    ).toEqual([90, 60, 30, 0]);
    for (const reminder_days of ["-1,30", "30,30", "30x", [90, -1]])
      expect(
        recordSchema(ENTITIES["jenis-sertifikat"]).safeParse({
          ...common,
          reminder_days,
        }).success,
      ).toBe(false);
  });
  it("removes PostgREST grammar while preserving internal identifiers", () => {
    const query = safeSearch("x),branch_code.eq.OTHER,(%*");
    expect(query).not.toMatch(/[(),%*]/);
    expect(safeSearch("a".repeat(200))).toHaveLength(100);
    expect(safeSearch("work_areas")).toBe("work_areas");
  });
});
describe("Scoped presentation and formatting", () => {
  it("does not grant a role across branches", () => {
    expect(
      hasPermission([{ branch_code: "DPS", role_code: "admin" }], "OTHER", [
        "admin",
      ]),
    ).toBe(false);
  });
  it("supports independent roles in one account", () => {
    const scopes = [
      { branch_code: "DPS", role_code: "account_manager" as const },
      { branch_code: "DPS", role_code: "hrga" as const },
    ];
    expect(hasPermission(scopes, "DPS", ["hrga"])).toBe(true);
    expect(hasPermission(scopes, "DPS", ["admin"])).toBe(false);
  });
  it("keeps dates and decimal money exact", () => {
    expect(formatBusinessDate("2026-10-28")).toContain("28");
    expect(formatRupiah("1250000.00")).toBe("Rp 1.250.000");
    expect(formatRupiah("900719925474099312.34")).toBe(
      "Rp 900.719.925.474.099.312,34",
    );
  });
});
