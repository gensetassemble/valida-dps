import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { addMonitoringSheets } from "@/features/operations/monitoring-export";
import {
  monitoringColumns,
  initialCalibrationFields,
  monitoringValue,
} from "@/features/operations/monitoring";
import { OPERATIONAL_ENTITIES } from "@/features/operations/entities";
import { recordSchema } from "@/features/master-data/validation";
describe("Monitoring report contract", () => {
  it("keeps separate ranges and correction points for a multi-parameter certificate", () => {
    const row = {
      measurement_range: "Temperature",
      correction_factor: "0\n4",
      monitoring_measurements: [
        {
          measurement_range: "Temperature",
          correction_factor: "0\n4",
          significant_yes: "√",
        },
        {
          measurement_range: "Humidity",
          correction_factor: "-1\n2",
          significant_yes: "√",
        },
      ],
    };
    expect(monitoringValue(row, "measurement_range")).toBe(
      "[1] Temperature\n[2] Humidity",
    );
    expect(monitoringValue(row, "correction_factor")).toBe(
      "[1] 0\n4\n\n[2] -1\n2",
    );
    expect(monitoringValue(row, "significant_yes")).toBe("√");
  });
  it("serializes all 21 monitoring columns with grouped headings, portfolio sheets and complete multiline factors", async () => {
    const book = new ExcelJS.Workbook(),
      factor = "0\n4\n26\n-0.0001";
    addMonitoringSheets(
      book,
      [
        {
          portfolio_code: "IND",
          name: "[CONTOH] Tester",
          tag: "[CONTOH] TAG",
          brand_type: "[CONTOH] Brand / Type",
          color: "Silver",
          latest_calibration_date: "2026-05-13",
          latest_due_date: "2027-05-13",
          correction_factor: factor,
          calibration_internal: "√",
          calibration_external: "-",
          significant_yes: "√",
          significant_no: "-",
        },
        {
          portfolio_code: "LAB",
          name: "[CONTOH] Meter",
          calibration_date_original: "N/A",
          due_date_original: "N/A",
        },
      ],
      "DPS",
    );
    const parsed = new ExcelJS.Workbook();
    await parsed.xlsx.load(await book.xlsx.writeBuffer());
    expect(parsed.worksheets.map((s) => s.name)).toEqual(["IND", "LAB"]);
    const sheet = parsed.getWorksheet("IND")!;
    expect(sheet.columnCount).toBe(21);
    expect(sheet.getCell("D4").value).toBe("Spesifikasi");
    expect(sheet.getCell("P4").value).toBe("Kalibrasi");
    expect(sheet.getCell("T5").value).toBe("Signifikan");
    expect(sheet.getCell("S7").value).toBe(factor);
    expect(sheet.getCell("L7").value).toBe("2026-05-13");
    expect(sheet.getCell("M7").value).toBe("2027-05-13");
    expect(sheet.getCell("P7").value).toBe("√");
    expect(parsed.getWorksheet("LAB")!.getCell("L7").value).toBe("N/A");
    expect(monitoringColumns).toHaveLength(20);
  });
  it("requires a valid initial date only when creating an initial calibration and rejects client ownership input", () => {
    const entity = OPERATIONAL_ENTITIES["kalibrasi-alat"];
    const payload = Object.fromEntries(
      [...entity.fields, ...initialCalibrationFields].map((f) => [
        f.key,
        f.kind === "boolean" ? true : "",
      ]),
    );
    Object.assign(payload, {
      name: "[CONTOH] Asset",
      portfolio_id: "40000000-0000-4000-8000-000000000001",
    });
    expect(recordSchema(entity).safeParse(payload).success).toBe(false);
    expect(
      recordSchema(entity).safeParse({
        ...payload,
        initial_calibration_date: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      recordSchema(entity).safeParse({
        ...payload,
        initial_calibration_date: "2026-10-20",
        initial_due_date: "2026-10-19",
      }).success,
    ).toBe(false);
    expect(
      recordSchema(entity).safeParse({
        ...payload,
        initial_calibration_date: "2026-10-20",
        initial_due_date: "2027-10-20",
      }).success,
    ).toBe(true);
    expect(
      recordSchema(entity).safeParse({ ...payload, initial_enabled: false })
        .success,
    ).toBe(true);
    expect(
      recordSchema(entity).safeParse({
        ...payload,
        initial_enabled: false,
        ownership: "client",
        client_id: "50000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(false);
  });
});
