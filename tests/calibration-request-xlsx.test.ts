import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { mkdir, writeFile } from "node:fs/promises";
import { calibrationRequestXlsx } from "@/features/workflows/request-xlsx";
describe("manual UMA Excel handoff", () => {
  it("fills source fields and original NPP, leaves time/cost blank even for legacy estimates", async () => {
    const bytes = await calibrationRequestXlsx({
      request_number: "[CONTOH] QA-197",
      request_kind: "repair",
      unit_name: "DPS",
      quantity: 1,
      requester_name: "[CONTOH] Koordinator",
      requester_npp: "04125",
      supervisor_name: "[CONTOH] Kepala UP",
      created_at: "2026-10-30T18:00:00Z",
      estimated_cost: 1250000,
      estimated_days: 7,
      notes: "[CONTOH] Perbaikan kondisi alat.",
      equipment_snapshot: {
        name: "[CONTOH] Hydrometer",
        serial: "QA-SERIAL",
        tag: "QA-TAG",
        location: "Denpasar",
        measurement_range: "0.9 - 1.1 kg/L",
      },
    });
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes);
    const s = book.worksheets[0];
    expect(s.getCell("E15").value).toBe("[CONTOH] Hydrometer");
    expect(s.getCell("E23").value).toBe("Perbaikan");
    expect(s.getCell("G43").value).toBe("NPP. 04125");
    expect(s.getCell("G36").value).toEqual(new Date("2026-10-31T00:00:00Z"));
    for (const cell of ["E29", "E31", "E32"])
      expect(s.getCell(cell).value).toBeNull();
    expect(s.getCell("B42").value).toContain("Kepala UP");
    expect(s.getCell("E16").value).toBe(1);
    expect(s.pageSetup.fitToWidth).toBe(1);
    await mkdir(".tools/uma-template", { recursive: true });
    await writeFile(
      ".tools/uma-template/filled-example.xlsx",
      Buffer.from(bytes),
    );
  });
});
