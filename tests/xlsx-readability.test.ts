import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { readableXlsx } from "@/lib/xlsx-readability";
import { monitoringXlsx } from "@/features/operations/monitoring-xlsx";
import { calibrationRequestXlsx } from "@/features/workflows/request-xlsx";
import { exportContinuationRows } from "@/lib/export-continuation";
describe("readable Excel exports", () => {
  it("continues oversized cell content without losing its text or hyperlink", () => {
    const text = "abcdefghij".repeat(250);
    const rows = exportContinuationRows(
      [{ text, hyperlink: "https://example.invalid" }],
      [24],
    );
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.map((r) => r[0].text.replace(/\n/g, "")).join("")).toBe(text);
    expect(
      rows.every((r) => r[0].hyperlink === "https://example.invalid"),
    ).toBe(true);
  });
  it("wraps all cells, removes shrinking, and grows merged and ordinary rows without changing values", async () => {
    const b = new ExcelJS.Workbook(),
      s = b.addWorksheet("Data");
    s.columns = [{ width: 12 }, { width: 12 }];
    s.getCell("A1").value = "Header panjang yang harus terbaca";
    s.getCell("A1").alignment = { shrinkToFit: true };
    s.mergeCells("A2:B3");
    s.getCell("A2").value = "Kalimat panjang ".repeat(35);
    s.getRow(2).height = 15;
    s.getRow(3).height = 15;
    s.getCell("B4").value = {
      text: "https://example.invalid/" + "folder/".repeat(30),
      hyperlink: "https://example.invalid",
    };
    const output = new ExcelJS.Workbook();
    await output.xlsx.load(
      Uint8Array.from(
        await readableXlsx(new Uint8Array(await b.xlsx.writeBuffer())),
      ).buffer,
    );
    const sheet = output.worksheets[0];
    expect(sheet.getCell("A1").alignment.wrapText).toBe(true);
    expect(sheet.getCell("A1").alignment.shrinkToFit).not.toBe(true);
    expect(sheet.getRow(1).height).toBeGreaterThan(30);
    expect(
      (sheet.getRow(2).height || 0) + (sheet.getRow(3).height || 0),
    ).toBeGreaterThan(100);
    expect(sheet.getRow(4).height).toBeGreaterThan(100);
    expect(sheet.getCell("B4").hyperlink).toBe("https://example.invalid");
    expect(sheet.getCell("A2").value).toBe(s.getCell("A2").value);
  });
  it("retains native monitoring data, wraps correction values and provides wider text columns", async () => {
    const bytes = await monitoringXlsx(
      [
        {
          name: "Alat dengan nama lengkap ".repeat(12),
          portfolio_code: "PIK",
          correction_factor: "Penjelasan koreksi panjang ".repeat(15),
          notes: "Catatan panjang ".repeat(20),
        },
      ],
      "DPS",
    );
    const w = new ExcelJS.Workbook();
    await w.xlsx.load(Uint8Array.from(bytes).buffer);
    const s = w.worksheets[0];
    expect(s.getCell("S9").alignment.wrapText).toBe(true);
    expect(s.getRow(9).height).toBeGreaterThan(100);
    expect(s.getColumn(22).width).toBe(30);
    expect(s.getCell("V9").text).toContain("Catatan panjang");
  });
  it("expands UMA cover fields when notes or identities are long", async () => {
    const bytes = await calibrationRequestXlsx({
      notes: "Keterangan perbaikan dan kalibrasi ".repeat(35),
      equipment_snapshot: {
        name: "Peralatan pengukuran dengan nama panjang ".repeat(8),
      },
    });
    const w = new ExcelJS.Workbook();
    await w.xlsx.load(Uint8Array.from(bytes).buffer);
    const s = w.worksheets[0];
    expect(s.getCell("E21").alignment.wrapText).toBe(true);
    expect(
      (s.getRow(21).height || 0) + (s.getRow(22).height || 0),
    ).toBeGreaterThan(50);
    expect(s.getCell("E21").text).toContain("Keterangan perbaikan");
  });
});
