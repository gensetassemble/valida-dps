import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { calibrationRequestXlsx } from "@/features/workflows/request-xlsx";
import {
  umaRequestNumber,
  umaFilename,
  umaSignatureDate,
  umaApproverTitle,
} from "@/features/workflows/uma-format";
describe("UMA portfolio bundle export", () => {
  it("formats saved identity and date without truncating official portfolio codes", () => {
    expect(umaRequestNumber("21", "PIK", "2026-07-03")).toBe(
      "0021/DPS-VII/OPS-PIK/2026",
    );
    expect(umaRequestNumber("9", "SERCO", "2026-11-03")).toBe(
      "0009/DPS-XI/OPS-SERCO/2026",
    );
    expect(umaRequestNumber("9", "PIK", "2026-13-03")).toBe("");
    expect(umaSignatureDate("2026-11-01T18:00:00Z", "Denpasar")).toBe(
      "Denpasar, 02 November 2026",
    );
    expect(umaApproverTitle("Fikri Haykal")).toBe(
      "Kepala Unit Pelayanan Lombok",
    );
    expect(
      umaFilename({
        created_at: "2026-07-01T00:00:00Z",
        portfolio_code_snapshot: "PIK",
      }),
    ).toBe("Pengajuan Kalibrasi Alat PIK 2026");
  });
  it("preserves native cover geometry and embeds all selected tools/readings on a landscape annex", async () => {
    const reading = Array.from(
      { length: 70 },
      (_, i) => `Titik ${i}: ${i * 10} mm`,
    ).join("\n");
    const bytes = await calibrationRequestXlsx({
      request_number: "0021/DPS-VII/OPS-PIK/2026",
      unit_name: "Cab Denpasar / PIK",
      requester_name: "[CONTOH] Koordinator",
      requester_npp: "04125",
      supervisor_name: "Taufik Talentino",
      created_at: "2026-07-01T00:00:00Z",
      equipment_snapshot: { name: "Caliper" },
      items_snapshot: [
        {
          id: "a",
          name: "Caliper",
          tag: "TAG-A",
          serial: "001",
          measurement_range: "0–200 mm",
          instrument_reading: reading,
        },
        {
          id: "b",
          name: "Meteran",
          tag: "TAG-B",
          measurement_range: "0–50 m",
          instrument_reading: "0\n10\n20",
        },
      ],
    });
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Uint8Array.from(bytes).buffer);
    const cover = book.worksheets[0],
      annex = book.getWorksheet("Lampiran Alat")!;
    expect(cover.getCell("E15").value).toBe(
      "  : Berbagai peralatan (terlampir)",
    );
    expect(cover.getCell("E16").value).toBe("  : 2 unit");
    expect(cover.getCell("B43").value).toBe(
      "Kepala Bidang Inspeksi dan Pengujian",
    );
    expect(annex.pageSetup.orientation).toBe("landscape");
    expect(annex.pageSetup.fitToHeight).toBe(0);
    expect(annex.getCell("A1").value).toBe(
      "LAMPIRAN PERMOHONAN KALIBRASI PERALATAN",
    );
    const strings: string[] = [];
    annex.eachRow((r) =>
      r.eachCell((c) => strings.push(String(c.value || ""))),
    );
    expect(strings.join("\n")).toContain("TAG-B");
    expect(strings.join("\n")).toContain("Titik 69: 690 mm");
    expect(annex.getRow(6).height).toBeLessThanOrEqual(409);
    const source = await JSZip.loadAsync(
      await readFile("src/assets/forms/FOR-SCI-UMA-197-Rev-02.xlsx"),
    );
    const output = await JSZip.loadAsync(bytes);
    const geometry = (x: string) =>
      x
        .replace(/<c\b[^>]*(?:\/>|>[\s\S]*?<\/c>)/g, "")
        .replace(/\s+(?:ht|customHeight)="[^"]*"/g, "")
        .replace(/<mergeCells\b[\s\S]*?<\/mergeCells>/, "");
    expect(cover.getCell("H15").master.address).toBe("E15");
    expect(
      geometry(await output.file("xl/worksheets/sheet1.xml")!.async("string")),
    ).toBe(
      geometry(await source.file("xl/worksheets/sheet1.xml")!.async("string")),
    );
    for (const name of Object.keys(source.files).filter(
      (n) => /drawing|media/.test(n) && !source.files[n].dir,
    ))
      expect(await output.file(name)!.async("uint8array")).toEqual(
        await source.file(name)!.async("uint8array"),
      );
  });
});
