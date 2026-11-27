import { describe, expect, it } from "vitest";
import { ENTITIES } from "@/features/master-data/registry";
import { certificateTypePresentation, visibleMasterRecord } from "@/features/master-data/certificate-type-visibility";
import { ALL_ROLES, hasPermission, canReadEmployeeArchive, canManageEmployeeDirectory } from "@/lib/auth/permissions";
import { recordSchema } from "@/features/master-data/validation";

describe("certificate type code visibility", () => {
  const original = ENTITIES["jenis-sertifikat"];
  const row = { id: "type-id", code: "INTERNAL_CODE", name: "Jenis uji", category: "client" };
  it.each(ALL_ROLES)("shows codes only for an explicit branch Super Admin, role %s", role => {
    const scopes = [{ branch_code: "DPS", role_code: role }];
    const entity = certificateTypePresentation(original, hasPermission(scopes, "DPS", ["super_admin"]));
    const allowed = role === "super_admin";
    expect(entity.columns.includes("code")).toBe(allowed);
    expect(entity.fields.some(field => field.key === "code")).toBe(allowed);
    expect(entity.search.includes("code")).toBe(allowed);
    expect(Object.hasOwn(visibleMasterRecord(entity, row), "code")).toBe(allowed);
    expect(visibleMasterRecord(entity, row).name).toBe(row.name);
  });
  it("does not inherit Super Admin visibility across branches or mutate the shared registry", () => {
    const entity = certificateTypePresentation(original, hasPermission([{ branch_code: "OTHER", role_code: "super_admin" }], "DPS", ["super_admin"]));
    expect(entity.columns).not.toContain("code");
    expect(original.columns).toContain("code");
    expect(row.code).toBe("INTERNAL_CODE");
    expect(certificateTypePresentation(ENTITIES.portofolio, false)).toBe(ENTITIES.portofolio);
  });
  it("allows authorized metadata forms without a code and rejects injected code values", () => {
    const entity = certificateTypePresentation(original, false);
    const fields = { name: "Jenis uji", category: "client", regulation_reference: "", issuer: "", default_validity_months: "", reminder_days: "90,60,30,0", is_active: true };
    expect(recordSchema(entity).safeParse(fields).success).toBe(true);
    expect(recordSchema(entity, true).safeParse({ ...fields, code: "FORGED" }).success).toBe(false);
  });
});
describe("QSHE archive reading", () => {
  it("reads own branch archive without gaining directory management rights", () => {
    const scopes = [{ branch_code: "DPS", role_code: "qshe" as const }];
    expect(canReadEmployeeArchive(scopes, "DPS")).toBe(true);
    expect(canReadEmployeeArchive(scopes, "OTHER")).toBe(false);
    expect(canManageEmployeeDirectory(scopes, "DPS")).toBe(false);
    expect(canReadEmployeeArchive([{ branch_code: "DPS", role_code: "inspector" }], "DPS")).toBe(false);
  });
});
