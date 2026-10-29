import { describe, expect, it } from "vitest";
import { ALL_ROLES, hasPermission, isRole, type Role } from "@/lib/auth/permissions";
import { ENTITIES } from "@/features/master-data/registry";
import { recordSchema } from "@/features/master-data/validation";

describe("Workflow role capabilities", () => {
  it("limits the IT Officer administrator grant to its explicit branch", () => {
    const scopes = [{ role_code: "super_admin" as const, branch_code: "DPS" }];
    expect(hasPermission(scopes, "DPS", ["admin"])).toBe(true);
    expect(hasPermission(scopes, "OTHER", ["admin"])).toBe(false);
  });
  it.each(["tester", "department_head", "unit_head"] as Role[])("keeps %s read-only across every entity", (role) => {
    const scopes = [{ role_code: role, branch_code: "DPS" }];
    expect(hasPermission(scopes, "DPS", ["branch_head"])).toBe(true);
    expect(hasPermission(scopes, "DPS", ["admin"])).toBe(false);
    for (const entity of Object.values(ENTITIES)) {
      expect(hasPermission(scopes, "DPS", entity.writeRoles)).toBe(false);
    }
    expect(hasPermission(scopes, "OTHER", ["branch_head"])).toBe(false);
  });
  it("accepts explicit new role assignments while rejecting inherited object keys", () => {
    for (const role_code of ALL_ROLES) {
      expect(recordSchema(ENTITIES["penugasan-peran"]).safeParse({
        profile_id: "20000000-0000-4000-8000-000000000001",
        role_code, grant_reason: "[CONTOH] Penugasan development yang disetujui.", is_active: true,
      }).success).toBe(true);
    }
    expect(isRole("constructor")).toBe(false);
    expect(isRole("__proto__")).toBe(false);
  });
});
