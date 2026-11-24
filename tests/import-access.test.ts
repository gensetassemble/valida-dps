import { describe, expect, it } from "vitest";
import {
  canImportDomain,
  importDomainsForScopes,
} from "@/features/imports/access";
import type { Scope } from "@/lib/auth/permissions";

const scope = (role_code: Scope["role_code"]): Scope => ({
  branch_code: "DPS",
  role_code,
});

describe("document import role access", () => {
  it.each([
    ["hrga", "personnel"],
    ["account_manager", "clients"],
    ["equipment_manager", "calibrations"],
  ] as const)("maps %s to %s", (role, domain) => {
    expect(canImportDomain([scope(role)], "DPS", domain)).toBe(true);
    expect(importDomainsForScopes([scope(role)], "DPS")).toEqual([domain]);
  });

  it("does not grant operational imports through Admin or Coordinator", () => {
    expect(importDomainsForScopes([scope("admin")], "DPS")).toEqual([
      "employees",
    ]);
    expect(importDomainsForScopes([scope("coordinator")], "DPS")).toEqual(
      [],
    );
  });

  it("keeps every permission branch-specific", () => {
    expect(canImportDomain([scope("hrga")], "TEST", "personnel")).toBe(false);
  });
});
