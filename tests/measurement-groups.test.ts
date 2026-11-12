import { describe, it, expect } from "vitest";
import {
  measurementGroupsSchema,
  measurementInputs,
  mergeMeasurementGroups,
} from "@/features/operations/measurement-groups";
import { monitoringValue } from "@/features/operations/monitoring";
import ExcelJS from "exceljs";
import { addMonitoringSheets } from "@/features/operations/monitoring-export";
describe("Repeatable measurement/factor pairs", () => {
  it("keeps a single recorded group authoritative over stale asset text", () => {
    expect(measurementInputs({
      measurement_range: "Old range",
      correction_factor: "Old factor",
      measurement_ranges: ["Old asset range"],
      monitoring_measurements: [{ measurement_range: "0–10 kg", correction_factor: "0,01" }],
    })).toEqual([{ measurement_range: "0–10 kg", correction_factor: "0,01", source_index: 0 }]);
    expect(measurementInputs({ monitoring_measurements: [] })).toEqual([
      { measurement_range: "", correction_factor: "" },
    ]);
  });
  it("keeps legacy records with an unknown range editable without inventing measurements", () => {
    expect(
      measurementGroupsSchema.safeParse([
        { measurement_range: "", correction_factor: "" },
      ]).success,
    ).toBe(true);
    expect(
      measurementGroupsSchema.safeParse([
        { measurement_range: "Hole", correction_factor: "1" },
        { measurement_range: "", correction_factor: "" },
      ]).success,
    ).toBe(false);
  });
  it("preserves pairing and trusted import metadata when removing a middle group", () => {
    const old = [
      { measurement_range: "Hole", correction_factor: "1", source_row: 10 },
      { measurement_range: "Wire", correction_factor: "2", source_row: 11 },
      { measurement_range: "Humidity", correction_factor: "3", source_row: 12 },
    ];
    const groups = mergeMeasurementGroups(
      [
        {
          measurement_range: "Hole edited",
          correction_factor: "0,022\n0,023",
          source_index: 0,
        },
        {
          measurement_range: "Humidity",
          correction_factor: "-1\n2",
          source_index: 2,
        },
      ],
      old,
      {},
    );
    expect(groups).toHaveLength(2);
    expect(groups[1]).toMatchObject({
      source_row: 12,
      correction_factor: "-1\n2",
    });
    expect(groups[0].source_row).toBe(10);
    expect(
      monitoringValue({ monitoring_measurements: groups }, "measurement_range"),
    ).toBe("[1] Hole edited\n[2] Humidity");
    expect(
      monitoringValue({ monitoring_measurements: groups }, "correction_factor"),
    ).toBe("[1] 0,022\n0,023\n\n[2] -1\n2");
  });
  it("does not fabricate ranges or distribute a legacy correction across new parameters", () => {
    expect(
      measurementInputs({ measurement_ranges: ["Hole", "Wire"] }, true),
    ).toEqual([
      { measurement_range: "Hole", correction_factor: "" },
      { measurement_range: "Wire", correction_factor: "" },
    ]);
    expect(
      measurementInputs({
        measurement_range: "Legacy range",
        correction_factor: "1\n2",
      }),
    ).toEqual([
      { measurement_range: "Legacy range", correction_factor: "1\n2" },
    ]);
  });
  it("rejects empty ranges, duplicate source references, forged metadata and stale source indices", () => {
    expect(
      measurementGroupsSchema.safeParse([
        { measurement_range: "", correction_factor: "1" },
      ]).success,
    ).toBe(false);
    expect(
      measurementGroupsSchema.safeParse(
        [0, 1].map(() => ({
          measurement_range: "Hole",
          correction_factor: "1",
          source_index: 0,
        })),
      ).success,
    ).toBe(false);
    expect(
      measurementGroupsSchema.parse([
        { measurement_range: "Hole", correction_factor: "1", source_row: 999 },
      ])[0],
    ).not.toHaveProperty("source_row");
    expect(() =>
      mergeMeasurementGroups(
        [
          {
            measurement_range: "Hole",
            correction_factor: "1",
            source_index: 2,
          },
        ],
        [],
        {},
      ),
    ).toThrow();
  });
  it("renders a single structured group and literal imported line breaks correctly", () => {
    expect(
      monitoringValue(
        {
          measurement_range: "stale",
          monitoring_measurements: [
            { measurement_range: "Hole", correction_factor: "0,022\\n0,023" },
          ],
        },
        "measurement_range",
      ),
    ).toBe("Hole");
    expect(
      monitoringValue(
        {
          monitoring_measurements: [
            { measurement_range: "Hole", correction_factor: "0,022\\n0,023" },
          ],
        },
        "correction_factor",
      ),
    ).toBe("0,022\n0,023");
  });
  it("exports the same pair numbers and all correction values after XLSX roundtrip", async () => {
    const book = new ExcelJS.Workbook();
    addMonitoringSheets(
      book,
      [
        {
          portfolio_code: "BBR",
          name: "[CONTOH] Alat",
          monitoring_measurements: [
            { measurement_range: "Hole", correction_factor: "1\n2" },
            { measurement_range: "Wire", correction_factor: "3\n4" },
          ],
        },
      ],
      "DPS",
    );
    const result = new ExcelJS.Workbook();
    await result.xlsx.load(await book.xlsx.writeBuffer());
    const sheet = result.worksheets[0];
    expect(sheet.getCell("R7").value).toBe("[1] Hole\n[2] Wire");
    expect(sheet.getCell("S7").value).toBe("[1] 1\n2\n\n[2] 3\n4");
  });
});
