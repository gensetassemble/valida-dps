import {describe, expect, it} from "vitest";
import {normalizeCalibrationLaboratory as normalize} from "@/features/operations/calibration-laboratories";
import {monitoringValue} from "@/features/operations/monitoring";

describe("Calibration laboratory names", () => {
  it("consolidates spelling, punctuation and capitalization variants", () => {
    for (const name of ["LAB CIBITUNG", "LAB.CIBITUNG", "Laboratorium Cibitung", "PT.SUCOFINDO Lab. Cibitung"])
      expect(normalize(name)).toBe("PT SUCOFINDO Laboratorium Cibitung");
    expect(normalize(" PT.  KALIMAN ")).toBe("PT Kaliman");
    expect(normalize("'PUSARPEDAL")).toBe("PUSARPEDAL");
  });
  it("preserves distinct branches, institutions and unknown sources", () => {
    expect(normalize("PT. CALTESYS INDONESIA - SBY")).toBe("PT Caltesys Indonesia (SBY)");
    expect(normalize("PT. Caltesys Indonesia")).toBe("PT Caltesys Indonesia");
    for (const name of ["PSIKLH", "PUSARPEDAL", "BRIN", "BSPJI", "N/A", "-", "Laboratorium Baru"])
      expect(normalize(name)).toBe(name);
  });
  it("uses the same labels for monitoring table and export", () => {
    expect(monitoringValue({monitoring_laboratory:"PT. KALIMAN"},"monitoring_laboratory")).toBe("PT Kaliman");
  });
});
