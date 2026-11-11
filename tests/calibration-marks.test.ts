import { describe, it, expect } from "vitest";
import {recordSchema} from '@/features/master-data/validation';
import {OPERATIONAL_ENTITIES} from '@/features/operations/entities';
import {
  calibrationMark,
  pairedCalibrationField,
  oppositeCalibrationMark,
  calibrationChoice,
  calibrationChoiceValue,
  laboratoryForCalibrationChoice,
} from "@/features/operations/calibration-marks";
import {
  monitoringCalibrationFields,
  monitoringValue,
} from "@/features/operations/monitoring";
describe("exclusive calibration report marks", () => {
  it("fills the internal laboratory and allows a new external laboratory", () => {
    expect(laboratoryForCalibrationChoice("√", "PT Caltesys Indonesia")).toBe("PT SUCOFINDO Laboratorium Cibitung");
    expect(laboratoryForCalibrationChoice("-", "PT SUCOFINDO Laboratorium Cibitung")).toBe("");
    expect(laboratoryForCalibrationChoice("-", "Laboratorium Baru")).toBe("Laboratorium Baru");
  });
  it("uses one choice per report pair for initial and subsequent calibrations", () => {
    for (const prefix of ["", "initial_"]) {
      expect(calibrationChoice(prefix + "calibration_internal")?.options).toEqual([
        { value: "√", label: "Internal" }, { value: "-", label: "Eksternal" },
      ]);
      expect(calibrationChoice(prefix + "significant_yes")?.options).toEqual([
        { value: "√", label: "Ya" }, { value: "-", label: "Tidak" },
      ]);
      expect(calibrationChoice(prefix + "calibration_external")).toBeNull();
      expect(calibrationChoice(prefix + "significant_no")).toBeNull();
    }
    expect(calibrationChoiceValue("✓", "-")).toBe("√");
    expect(calibrationChoiceValue("-", "✔")).toBe("-");
    expect(calibrationChoiceValue("√", "√")).toBe("");
    expect(calibrationChoiceValue("-", "-")).toBe("");
    expect(calibrationChoiceValue("√", "")).toBe("");
  });
  it('rejects contradictory marks on the server',()=>{
    const entity=OPERATIONAL_ENTITIES['riwayat-kalibrasi'];
    const payload=Object.fromEntries(entity.fields.map(f=>[f.key,f.kind==='boolean'?true:f.kind==='select'?(f.options?.[0]?.value||''):'']));
    Object.assign(payload,{equipment_id:'40000000-0000-4000-8000-000000000001',calibration_internal:'√',calibration_external:'-',significant_yes:'-',significant_no:'√'});
    expect(recordSchema(entity).safeParse(payload).success).toBe(true);
    expect(recordSchema(entity).safeParse({...payload,calibration_external:'√'}).success).toBe(false);
    expect(recordSchema(entity).safeParse({...payload,significant_no:'-'}).success).toBe(false);
  });
  it("pairs internal/external and significant columns including initial calibration", () => {
    expect(pairedCalibrationField("calibration_internal")).toBe(
      "calibration_external",
    );
    expect(pairedCalibrationField("initial_significant_no")).toBe(
      "initial_significant_yes",
    );
    expect(pairedCalibrationField("serial")).toBeNull();
    expect(oppositeCalibrationMark("√")).toBe("-");
    expect(oppositeCalibrationMark("-")).toBe("√");
  });
  it("provides only yes/no selections and renders historical tick variants consistently", () => {
    for (const field of monitoringCalibrationFields.filter((f) =>
      pairedCalibrationField(f.key),
    ))
      expect(field.options?.map((o) => o.value)).toEqual(["√", "-"]);
    expect(calibrationMark("'√")).toBe("√");
    expect(calibrationMark("✓")).toBe("√");
    expect(
      monitoringValue({ calibration_external: "'√" }, "calibration_external"),
    ).toBe("√");
    expect(
      monitoringValue(
        { monitoring_measurements: [{ significant_no: "✓" }] },
        "significant_no",
      ),
    ).toBe("√");
  });
});
