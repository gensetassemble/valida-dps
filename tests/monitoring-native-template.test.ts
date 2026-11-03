import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import {
  monitoringXlsx,
  monitoringFilename,
} from "@/features/operations/monitoring-xlsx";
describe("FOR/SCI-UMA/198 native monitoring template", () => {
  it("retains native geometry, logo, revision, dates and correction rows, without example records or signatures", async () => {
    const rows = [
      {
        name: "[CONTOH] Caliper",
        tag: "QA-TAG",
        portfolio_code: "PIK",
        latest_calibration_date: "2026-07-01",
        latest_due_date: "2027-07-01",
        measurement_range: "0–200 mm",
        correction_factor: "0,1\n0,2\n0,3\n0,4",
        notes: "[CONTOH] Catatan pengguna",
      },
      {
        name: "[CONTOH] Meter",
        portfolio_code: "PIK",
        correction_factor: Array.from(
          { length: 25 },
          (_, i) => "Nilai " + i,
        ).join("\n"),
      },
    ];
    const bytes = await monitoringXlsx(rows, "DPS", "2026-11-03");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Uint8Array.from(bytes).buffer);
    const s = book.getWorksheet("PIK")!;
    expect(s).toBeTruthy();
    expect(s.getCell("A2").value).toBe("LAPORAN MONITORING PERALATAN");
    expect(s.getCell("A3").value).toBe(
      "Unit Kerja : Divisi/ SBU/ Cabang Denpasar -- PIK",
    );
    expect(s.getCell("A4").value).toBe("Periode   : 2026");
    expect(s.getCell("B9").value).toBe("[CONTOH] Caliper");
    expect(s.getCell("C9").value).toBe("QA-TAG");
    expect(s.getCell("L9").value).toEqual(new Date("2026-07-01T00:00:00Z"));
    expect(s.getCell("S9").value).toBe("0,1");
    expect(s.getCell("S12").value).toBe("0,4");
    expect(s.getCell("S44").value).toBe("Nilai 24");
    expect(s.getCell("V6").value).toBe("Keterangan");
    expect(s.getCell("V9").value).toContain("Catatan pengguna");
    expect(s.getCell("A2").font).toMatchObject({
      name: "Arial",
      size: 14,
      bold: true,
    });
    expect(s.getColumn(2).width).toBe(28);
    expect(s.pageSetup.orientation).toBe("landscape");
    expect(s.pageSetup.fitToHeight).toBe(0);
    expect(s.pageSetup.printTitlesRow).toBe("1:8");
    expect(s.getImages()).toHaveLength(1);
    expect(s.headerFooter.oddFooter).toContain("&P dari &N");
    const source = await JSZip.loadAsync(
      await readFile("src/assets/forms/FOR-SCI-UMA-198-Rev-03.xlsx"),
    );
    const out = await JSZip.loadAsync(bytes);
    const outputStyles = await out.file("xl/styles.xml")!.async("string");
    const sourceStyles = await source.file("xl/styles.xml")!.async("string");
    for (const tag of ["fonts", "fills", "borders"])
      expect(
        outputStyles.match(
          new RegExp("<" + tag + "\\b[\\s\\S]*?</" + tag + ">"),
        )?.[0],
      ).toEqual(
        sourceStyles.match(
          new RegExp("<" + tag + "\\b[\\s\\S]*?</" + tag + ">"),
        )?.[0],
      );
    expect(s.getCell("B9").alignment.wrapText).toBe(true);
    const all = (
      await Promise.all(
        Object.keys(out.files)
          .filter((f) => f.endsWith(".xml"))
          .map((f) => out.file(f)!.async("string")),
      )
    ).join("");
    expect(
      Object.keys(out.files).filter(
        (f) => f.startsWith("xl/media/") && !out.files[f].dir,
      ),
    ).toHaveLength(1);
    expect(out.file("xl/sharedStrings.xml")).toBeNull();
    expect(all).toContain("FOR/SCI-UMA/198");
  });
  it("exports multiple portfolios as separate native sheets and names the file ALL", async () => {
    const rows = [
      { name: "A", portfolio_code: "PIK" },
      { name: "B", portfolio_code: "BBR" },
    ];
    expect(monitoringFilename(rows, "2026-11-03")).toBe(
      "Form Laporan Monitoring Peralatan - ALL 2026.xlsx",
    );
    expect(monitoringFilename([rows[0]], "2026-11-03")).toBe(
      "Form Laporan Monitoring Peralatan - PIK 2026.xlsx",
    );
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(
      Uint8Array.from(await monitoringXlsx(rows, "DPS")).buffer,
    );
    expect(book.worksheets.map((s) => s.name)).toEqual(["PIK", "BBR"]);
    expect(book.worksheets.every((s) => s.getImages().length === 1)).toBe(true);
  });
});
