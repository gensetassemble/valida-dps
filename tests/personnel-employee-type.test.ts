import { describe, expect, it } from "vitest";
import { personnelFilterOptions } from "@/features/operations/personnel-filter-options";

describe("personnel employee type", () => {
  it("offers NPP and Non-NPP as explicit list filters", () => {
    expect(personnelFilterOptions.find((group) => group.key === "employee_type")?.options).toEqual([
      ["", "Semua pegawai"],
      ["npp", "Pegawai NPP"],
      ["non_npp", "Pegawai Non-NPP"],
    ]);
  });
});
