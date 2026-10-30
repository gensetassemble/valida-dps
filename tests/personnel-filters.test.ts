import { describe, expect, it } from "vitest";
import { personnelFilterQuery } from "@/features/operations/personnel-filter-options";
import { ENTITIES, MASTER_KEYS } from "@/features/master-data/registry";
import { ALL_ROLES, hasPermission } from "@/lib/auth/permissions";
describe("personnel quick filters", () => {
  it("preserves branch, search, portfolio and active state while resetting scroll pagination", () => {
    const next = personnelFilterQuery(
      "branch=DPS&q=operator&portfolio=example&active=true&page=3",
      "validity",
      "Expired",
    );
    expect(Object.fromEntries(next)).toEqual({
      branch: "DPS",
      q: "operator",
      portfolio: "example",
      active: "true",
      validity: "Expired",
    });
  });
  it("translates legacy validity-kind filters and avoids contradictory lifetime/expiry selections", () => {
    expect(
      Object.fromEntries(
        personnelFilterQuery(
          "filter=validity_kind&value=term",
          "active",
          "false",
        ),
      ),
    ).toEqual({ kind: "term", active: "false" });
    expect(
      personnelFilterQuery("validity=Expired", "kind", "lifetime").has(
        "validity",
      ),
    ).toBe(false);
    expect(
      personnelFilterQuery("kind=lifetime", "validity", "Expired").has("kind"),
    ).toBe(false);
    expect(
      personnelFilterQuery(
        "kind=lifetime&validity=Berlaku+Seumur+Hidup",
        "kind",
        "term",
      ).has("validity"),
    ).toBe(false);
    expect(
      personnelFilterQuery("active=true", "active", "").has("active"),
    ).toBe(false);
  });
});
describe("coordinator directory", () => {
  it("is available in master data without granting workflow or login access", () => {
    const entity = ENTITIES["koordinator-operasional"];
    expect(MASTER_KEYS).toContain(entity.key);
    expect(entity.table).toBe("operational_coordinators");
    expect(entity.fields.map((f) => f.key)).not.toContain("role_code");
    for (const role of ALL_ROLES) {
      const scope = [{ branch_code: "DPS", role_code: role }];
      expect(hasPermission(scope, "DPS", entity.readRoles)).toBe(true);
      expect(hasPermission(scope, "DPS", entity.writeRoles)).toBe(
        ["admin", "super_admin"].includes(role),
      );
      expect(hasPermission(scope, "OTHER", entity.readRoles)).toBe(false);
    }
  });
});
