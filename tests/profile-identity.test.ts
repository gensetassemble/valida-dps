import { describe, expect, it } from "vitest";
import { ENTITIES } from "@/features/master-data/registry";
import { recordSchema } from "@/features/master-data/validation";
import { hasPermission, type Role } from "@/lib/auth/permissions";

describe("profile identity and workflow pages", () => {
  it("accepts identity and optional password without a client-supplied UUID", () => {
    const entity = ENTITIES.pengguna;
    expect(
      entity.fields.filter((f) => f.key !== "is_active").map((f) => f.label),
    ).toEqual(["Nama", "Email", "NPP", "WhatsApp", "Password"]);
    const input = {
      full_name: "[CONTOH] User",
      email: "user@example.invalid",
      npp: "00123",
      whatsapp: "08123456789",
      is_active: false,
    };
    expect(recordSchema(entity).parse(input).npp).toBe("00123");
    expect(
      recordSchema(entity).safeParse({
        ...input,
        id: "ef100000-0000-4000-8000-000000000002",
      }).success,
    ).toBe(false);
  });
  const roles: [Role, boolean[], boolean[]][] = [
    ["super_admin", [true, true, true], [true, true, true]],
    ["tester", [true, true, true], [false, false, false]],
    ["account_manager", [true, false, false], [true, false, false]],
    ["hrga", [false, true, false], [false, true, false]],
    ["coordinator", [false, true, true], [false, false, false]],
    ["qshe", [true, true, true], [false, false, false]],
    ["equipment_manager", [false, false, true], [false, false, true]],
    ["department_head", [true, true, true], [false, false, false]],
    ["unit_head", [true, true, true], [false, false, false]],
    ["branch_head", [true, true, true], [false, false, false]],
  ];
  for (const [role, reads, writes] of roles)
    it(`keeps ${role} pages available according to its task`, () => {
      for (const [index, key] of [
        "sertifikat-klien",
        "kompetensi-personil",
        "kalibrasi-alat",
      ].entries()) {
        const scope = [{ role_code: role, branch_code: "DPS" }];
        expect(hasPermission(scope, "DPS", ENTITIES[key].readRoles)).toBe(
          reads[index],
        );
        expect(hasPermission(scope, "DPS", ENTITIES[key].writeRoles)).toBe(
          writes[index],
        );
        expect(hasPermission(scope, "OTHER", ENTITIES[key].readRoles)).toBe(
          false,
        );
      }
    });
});
