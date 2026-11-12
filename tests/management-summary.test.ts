import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { mkdir, writeFile } from "node:fs/promises";
import { managementSummary, withManagementSummary, type SummaryEntity } from "@/features/operations/management-summary";
import { addClientSheet } from "@/features/operations/client-export";
import { addPersonnelSheet } from "@/features/operations/personnel-export";
import { monitoringXlsx } from "@/features/operations/monitoring-xlsx";
import { readableXlsx } from "@/lib/xlsx-readability";

const today = "2026-11-12";
const dates = ["2026-11-11", "2026-11-12", "2026-12-12", "2026-12-13", "2027-01-11", "2027-01-12", "2027-02-10", "2027-02-11", null];
describe("management summary exports", () => {
  it("uses exact WITA boundaries, includes unknown dates and lifetime, and reconciles counts", () => {
    const rows = dates.map((expiry_date, i) => ({ id: String(i), expiry_date }));
    const data = managementSummary([...rows, { id: "life", validity_kind: "lifetime", expiry_date: null }], "kompetensi-personil", today);
    expect(data.buckets.map(b => b.count)).toEqual([1, 2, 2, 2, 1, 1, 1]);
    expect(data.total).toBe(10);
    expect(data.urgent).toBe(3);
    expect(data.upcoming).toBe(6);
    expect(data.buckets.reduce((sum, b) => sum + b.share, 0)).toBeCloseTo(1);
    expect(managementSummary([], "sertifikat-klien", today).buckets.every(b => b.share === 0)).toBe(true);
  });
  it("counts each tool once, uses legacy fallback dates, and ignores physical factor rows", () => {
    const tool = { id: "one", latest_due_date: "2026-11-01", monitoring_measurements: [{ correction_factor: "0\n1\n2" }] };
    expect(managementSummary([tool, tool, { id: "two", due_date_original: "2027-03-01" }], "kalibrasi-alat", today).buckets.map(b => b.count)).toEqual([1, 0, 0, 0, 1, 0, 0]);
  });
  for (const entity of ["sertifikat-klien", "kompetensi-personil", "kalibrasi-alat"] as SummaryEntity[])
    it(`adds an editable chart and first summary tab while preserving the ${entity} report`, async () => {
      const rows = dates.map((date, i) => ({ id: String(i), expiry_date: date, latest_due_date: date,
        client_name: `Pelanggan ${i + 1}`, name: `Alat ${i + 1}`, employee_name: `Pegawai ${i + 1}`,
        validity_kind: "dated", original_license_title: "Lisensi Pengujian", certificate_number: `CERT-${i + 1}`,
        portfolio_code: i % 2 ? "LAB" : "PIK", measurement_range: "0–50 mm", correction_factor: "0\n0,1" }));
      const book = new ExcelJS.Workbook();
      let original: Uint8Array;
      if (entity === "kalibrasi-alat") original = await monitoringXlsx(rows, "DPS", today);
      else {
        if (entity === "sertifikat-klien") addClientSheet(book, rows, today);
        else addPersonnelSheet(book, rows, "Cabang Denpasar", today);
        original = await readableXlsx(new Uint8Array(await book.xlsx.writeBuffer()));
      }
      const bytes = await withManagementSummary(original, { entity, rows, branch: "DPS", today });
      const sourceZip = await JSZip.loadAsync(original), zip = await JSZip.loadAsync(bytes);
      for (const path of Object.keys(sourceZip.files).filter(p => /^xl\/(worksheets\/sheet\d+\.xml|media\/|drawings\/)/.test(p) && !sourceZip.files[p].dir)) {
        if (path.startsWith("xl/worksheets/")) {
          const before = (await sourceZip.file(path)!.async("string")).replace(/tabSelected="1"/g, 'tabSelected="0"');
          expect(await zip.file(path)!.async("string")).toBe(before);
        } else expect(await zip.file(path)!.async("uint8array")).toEqual(await sourceZip.file(path)!.async("uint8array"));
      }
      const workbook = await zip.file("xl/workbook.xml")!.async("string");
      expect(workbook).toMatch(/<sheets><sheet name="Ringkasan Manajemen"/);
      expect(workbook).toContain('localSheetId="0">');
      const chart = await zip.file("xl/charts/valida-validity.xml")!.async("string");
      expect(chart).toContain("'Ringkasan Manajemen'!$C$12:$C$18");
      expect(chart.match(/<c:dPt>/g)).toHaveLength(7);
      const loaded = new ExcelJS.Workbook();
      await loaded.xlsx.load(Uint8Array.from(bytes).buffer);
      const summary = loaded.worksheets[0];
      expect(summary.name).toBe("Ringkasan Manajemen");
      expect(summary.getCell("B7").value).toBe(rows.length);
      expect(summary.getCell("C12").value).toBe(1);
      expect(summary.getCell("C19").value).toBe(rows.length);
      expect(loaded.worksheets.length).toBe(entity === "kalibrasi-alat" ? 3 : 2);
      if (process.env.SUMMARY_VISUAL_QA === "1") {
        await mkdir(".tools/management-summary-visual", { recursive: true });
        await writeFile(`.tools/management-summary-visual/${entity}.xlsx`, bytes);
      }
    });
  it("handles empty files and refuses accidental duplicate summary insertion", async () => {
    const book = new ExcelJS.Workbook(); addClientSheet(book, [], today);
    const bytes = await withManagementSummary(new Uint8Array(await book.xlsx.writeBuffer()), { entity: "sertifikat-klien", rows: [], branch: "DPS", today });
    const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(Uint8Array.from(bytes).buffer);
    expect(loaded.worksheets[0].getCell("B7").value).toBe(0);
    expect(loaded.worksheets[0].getCell("D19").value).toBe(0);
    await expect(withManagementSummary(bytes, { entity: "sertifikat-klien", rows: [], branch: "DPS", today })).rejects.toThrow("sudah ditambahkan");
  });
});
