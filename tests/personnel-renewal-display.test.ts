import { describe, expect, it } from "vitest";
import { personnelRenewalDisplay } from "@/features/workflows/model";
describe("personnel renewal badges", () => {
  it("shows an unopened process only for attention buckets", () => {
    for (const validity of ["Expired", "Kritis", "Perhatian", "Pantau"]) expect(personnelRenewalDisplay(null, validity)).toBe("unprocessed");
    for (const validity of ["Aman", "Tanggal Belum Diisi", "Berlaku Seumur Hidup", ""]) expect(personnelRenewalDisplay("unprocessed", validity)).toBeNull();
  });
  it("retains real progress/history while excluding lifetime renewals", () => {
    expect(personnelRenewalDisplay("processing", "Aman")).toBe("processing");
    expect(personnelRenewalDisplay("renewed", "Aman")).toBe("renewed");
    expect(personnelRenewalDisplay("processing", "Aman", true)).toBeNull();
    expect(personnelRenewalDisplay("forged", "Kritis")).toBeNull();
  });
});
