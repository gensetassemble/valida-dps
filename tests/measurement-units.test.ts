import { describe, it, expect } from "vitest";
import { historicalUnitSymbols, splitMeasurement, joinMeasurement, SI_UNITS } from "@/features/operations/measurement-units";
describe("measurement symbols and existing ranges", () => {
  it("separates simple ranges and symbols, including unspaced historical values", () => {
    expect(splitMeasurement("0-2000/1mm")).toEqual({ range: "0-2000/1", unit: "mm" });
    expect(splitMeasurement("5000 Ω")).toEqual({ range: "5000", unit: "Ω" });
    expect(splitMeasurement("0.990 – 1.040 kg/l")).toEqual({ range: "0.990 – 1.040", unit: "kg/l" });
    expect(splitMeasurement("0–10 cSt")).toEqual({ range: "0–10", unit: "cSt" });
  });
  it("preserves compound source text and does not infer a unit from missing values", () => {
    for (const raw of ["N/A", "-", "0-1000 mL / ±5 mL", "CO 0–25 ppm; CO2 0–2000 ppm", "2.36 mm -- Hole"])
      expect(splitMeasurement(raw)).toEqual({ range: raw, unit: "" });
  });
  it("keeps SI case sensitivity and custom/historical units without conversion", () => {
    expect(SI_UNITS).toContain("mA"); expect(SI_UNITS).not.toContain("ma");
    expect(joinMeasurement(" 0–2000 ", "mm")).toBe("0–2000 mm");
    expect(joinMeasurement("0–25", "cSt")).toBe("0–25 cSt");
    expect(historicalUnitSymbols(["0–100 kg/l", "5000 Ω", "10 KGF", "1000 ml", "10 mm", "10 mm"]))
      .toEqual(expect.arrayContaining(["kg/l", "Ω", "KGF", "ml"]));
    expect(historicalUnitSymbols(["10 mm"])).toEqual([]);
  });
});
