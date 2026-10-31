import { describe, expect, it } from "vitest";
import { dashboardStatusHref } from "@/lib/domain/dashboard-filter";
describe("dashboard status card toggle", () => {
  it("removes the selected status and retains other facets", () => {
    const p = { validity: "Aman", portfolio: "asset-portfolio", category: "calibrations", from: "2026-10-01", page: "4", examples: "false" };
    const url = new URL(dashboardStatusHref(p, "DPS", "Aman"), "https://valida.example");
    expect(url.searchParams.has("validity")).toBe(false);
    expect(Object.fromEntries(url.searchParams)).toEqual({ branch: "DPS", portfolio: "asset-portfolio", category: "calibrations", from: "2026-10-01", page: "1", examples: "false" });
    expect(p.validity).toBe("Aman");
  });
  it("selects another status and can toggle it off again", () => {
    const selected = new URL(dashboardStatusHref({ validity: "Aman" }, "DPS", "Expired"), "https://valida.example");
    expect(selected.searchParams.get("validity")).toBe("Expired");
    const reset = new URL(dashboardStatusHref(Object.fromEntries(selected.searchParams), "DPS", "Expired"), selected);
    expect(reset.searchParams.has("validity")).toBe(false);
  });
});
