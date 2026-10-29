import { describe, expect, it } from "vitest";
import { dashboardFilters, dashboardScope } from "@/lib/auth/module-access";
import type { Role } from "@/lib/auth/permissions";
describe("dashboard role scope", () => {
  it("discards unrelated stale client filters for PTK", () => {
    expect(
      dashboardFilters(
        {
          category: "clients",
          client: "client-id",
          marketing: "am-id",
          type: "client-type",
          kind: "lifetime",
          eligibility: "Tidak Layak Pakai",
          portfolio: "portfolio-id",
        },
        "calibrations",
      ),
    ).toEqual({
      category: "calibrations",
      eligibility: "Tidak Layak Pakai",
      portfolio: "portfolio-id",
    });
  });
  for (const [role, category] of [
    ["equipment_manager", "calibrations"],
    ["account_manager", "clients"],
    ["hrga", "personnel"],
  ] as const)
    it(`focuses ${role} and ignores unauthorized category parameters`, () => {
      for (const requested of [
        undefined,
        "all",
        "clients",
        "personnel",
        "calibrations",
      ])
        expect(
          dashboardScope(
            [{ branch_code: "DPS", role_code: role }],
            "DPS",
            requested,
          ),
        ).toEqual({ domains: [category], category });
    });
  it("keeps coordinator dashboard limited to personnel and calibration", () => {
    expect(
      dashboardScope(
        [{ branch_code: "DPS", role_code: "coordinator" }],
        "DPS",
        "clients",
      ),
    ).toEqual({ domains: ["personnel", "calibrations"], category: "all" });
  });
  for (const role of [
    "super_admin",
    "tester",
    "qshe",
    "department_head",
    "unit_head",
    "branch_head",
  ] as Role[])
    it(`preserves cross-module reading for ${role}`, () => {
      expect(
        dashboardScope([{ branch_code: "DPS", role_code: role }], "DPS")
          .domains,
      ).toHaveLength(3);
      expect(
        dashboardScope([{ branch_code: "DPS", role_code: role }], "OTHER")
          .domains,
      ).toHaveLength(0);
    });
});
